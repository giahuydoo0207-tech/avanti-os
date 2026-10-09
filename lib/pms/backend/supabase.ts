// Backend THẬT: đọc dữ liệu từ các bảng Supabase (đã lọc theo chi nhánh bằng RLS)
// và thực hiện mọi thao tác nghiệp vụ qua RPC trong supabase/migrations/0002_rpc.sql.
// Sau mỗi thao tác (hoặc khi quầy khác thay đổi dữ liệu — Realtime) state được tải lại.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ISODate, PmsState, Result, Session } from "../types";
import type { GuestInput, PmsActions, PmsBackend } from "./types";

type Row = Record<string, unknown>;
const SYSTEM = "HỆ THỐNG";
const PAGE = 1000; // giới hạn số dòng mỗi lần đọc của Supabase

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const snake = (k: string) => k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
function toCamel<T>(row: Row): T { const o: Row = {}; for (const [k, v] of Object.entries(row)) o[camel(k)] = v; return o as T; }
function toSnake(obj: Row): Row { const o: Row = {}; for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[snake(k)] = v === "" && /date|dob|expiry/i.test(k) ? null : v; return o; }

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = <T = never,>(error: string): Result<T> => ({ ok: false, error });

async function fetchAll(sb: SupabaseClient, table: string, order: string, ascending = true, limit = Infinity): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; out.length < limit; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").order(order, { ascending }).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out.slice(0, limit);
}

export async function loadPmsState(sb: SupabaseClient, today: ISODate): Promise<PmsState> {
  const [branches, roomTypes, rooms, guests, reservations, folios, transactions, staff, hkLogs, shiftReports, shiftTasks, activities] = await Promise.all([
    fetchAll(sb, "branches", "code"), fetchAll(sb, "room_types", "code"), fetchAll(sb, "rooms", "number"), fetchAll(sb, "guests", "created_at"),
    fetchAll(sb, "reservations", "arrival_date"), fetchAll(sb, "folios", "opened_at"), fetchAll(sb, "folio_transactions", "posted_at"),
    fetchAll(sb, "staff_profiles", "full_name"), fetchAll(sb, "housekeeping_logs", "changed_at", false, 300),
    fetchAll(sb, "shift_reports", "created_at", false), fetchAll(sb, "shift_tasks", "id"), fetchAll(sb, "activity_logs", "created_at", false, 300),
  ]);
  const names = new Map(staff.map(s => [s.id as string, s.full_name as string]));
  const nameOf = (id: unknown) => (id ? names.get(id as string) ?? "NHÂN VIÊN" : SYSTEM);
  return {
    version: 0, seededFor: today, seq: { confirmation: 0, folio: 0 },
    branches: branches.map(r => toCamel(r)),
    roomTypes: roomTypes.map(r => toCamel(r)),
    rooms: rooms.map(r => toCamel(r)),
    guests: guests.map(r => ({ ...toCamel<PmsState["guests"][number]>(r), nationality: String(r.nationality ?? "VN").trim() })),
    reservations: reservations.map(r => ({ ...toCamel<PmsState["reservations"][number]>(r), createdBy: nameOf(r.created_by) })),
    folios: folios.map(r => toCamel(r)),
    transactions: transactions.map(r => ({ ...toCamel<PmsState["transactions"][number]>(r), postedBy: nameOf(r.posted_by) })),
    hkLogs: hkLogs.map(r => ({ ...toCamel<PmsState["hkLogs"][number]>(r), changedBy: nameOf(r.changed_by) })),
    shiftReports: shiftReports.map(r => ({
      ...toCamel<PmsState["shiftReports"][number]>(r), reporterName: nameOf(r.reporter_id),
      confirmedByName: r.confirmed_by ? nameOf(r.confirmed_by) : null,
    })),
    shiftTasks: shiftTasks.map(r => toCamel(r)),
    activities: activities.map(r => ({ ...toCamel<PmsState["activities"][number]>(r), actorName: nameOf(r.actor_id) })),
  };
}

export function createSupabaseBackend(sb: SupabaseClient, session: Session, today: ISODate, opts: { realtime: boolean }): PmsBackend {
  let state: PmsState | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());
  const reload = async () => { state = await loadPmsState(sb, today); emit(); };

  // Gọi RPC; lỗi nghiệp vụ (RAISE EXCEPTION) trả về nguyên văn thông điệp tiếng Việt
  const call = async <T,>(fn: string, args: Row): Promise<Result<T>> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return fail(error.message);
    try { await reload(); } catch (e) { return fail(`Đã lưu nhưng tải lại dữ liệu lỗi: ${(e as Error).message}`); }
    return ok(data as T);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;

  const actions: PmsActions = {
    async createReservation(i) {
      const r = await call<string>("create_reservation", { p: {
        guest_id: i.guestId ?? null, guest: i.guest ? toSnake(i.guest as unknown as Row) : null, room_type_id: i.roomTypeId, room_id: i.roomId,
        arrival_date: i.arrivalDate, departure_date: i.departureDate, adults: i.adults, children: i.children, rate: i.rate,
        meal_plan: i.mealPlan, source: i.source, status: i.status, note: i.note,
        deposit_amount: i.deposit?.amount ?? 0, deposit_method: i.deposit?.method ?? null,
      } });
      return r.ok ? ok({ id: r.value }) : r;
    },
    async updateGuest(guestId, patch: Partial<GuestInput>) {
      if (patch.fullName !== undefined && !patch.fullName.trim()) return fail("Họ tên không được để trống");
      const body = toSnake({ ...patch, fullName: patch.fullName?.trim().toUpperCase() } as Row);
      const { error } = await sb.from("guests").update(body).eq("id", guestId);
      if (error) return fail(error.message);
      await reload();
      return ok(undefined);
    },
    assignRoom: (id, roomId) => call("assign_room", { p_reservation_id: id, p_room_id: roomId }),
    moveReservation: (id, roomId, arrival) => call("move_reservation", { p_reservation_id: id, p_room_id: roomId, p_arrival: arrival }),
    cancelReservation: id => call("cancel_reservation", { p_reservation_id: id }),
    checkIn: (id, deposit) => call("check_in", { p_reservation_id: id, p_deposit_amount: Math.round(deposit?.amount ?? 0), p_deposit_method: deposit?.method ?? null }),
    postTransaction: (folioId, i) => call("post_transaction", { p_folio_id: folioId, p_code: i.code, p_description: i.description, p_amount: Math.round(i.amount), p_payment_method: i.paymentMethod ?? null }),
    voidTransaction: id => call("void_transaction", { p_transaction_id: id }),
    async checkOut(id, o) {
      const r = await call<{ change: number }>("check_out", { p_reservation_id: id, p_discount_percent: o.discountPercent || 0, p_payment_method: o.payment?.method ?? null, p_payment_amount: Math.round(o.payment?.amount ?? 0) });
      return r.ok ? ok({ change: Number(r.value?.change ?? 0) }) : r;
    },
    setHousekeeping: (roomId, status) => call("set_housekeeping", { p_room_id: roomId, p_status: status }),
    submitShiftReport: i => call("submit_shift_report", { p: {
      business_date: i.businessDate, shift: i.shift, handover_to_name: i.handoverToName, cash_balance: i.cashBalance,
      general_note: i.generalNote, incident_note: i.incidentNote, tasks: i.tasks,
    } }),
    confirmShiftReport: id => call("confirm_shift_report", { p_report_id: id }),
    toggleShiftTask: id => call("toggle_shift_task", { p_task_id: id }),
    resetDemo: async () => fail("Khôi phục dữ liệu chỉ có ở chế độ demo — dùng script npm run seed:supabase"),
  };

  return {
    mode: "supabase",
    getSnapshot: () => state,
    subscribe: l => { listeners.add(l); return () => { listeners.delete(l); }; },
    async init() {
      await reload();
      if (opts.realtime && !channel) {
        // Quầy lễ tân khác thay đổi dữ liệu → tải lại (gom nhiều thay đổi trong 400ms)
        const onChange = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { reload().catch(() => {}); }, 400); };
        channel = sb.channel(`pms-${session.branchId}`);
        for (const table of ["rooms", "reservations", "folio_transactions", "shift_reports", "activity_logs"])
          channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
        channel.subscribe();
      }
    },
    actions,
    dispose() { if (channel) { sb.removeChannel(channel); channel = null; } if (timer) clearTimeout(timer); },
  };
}
