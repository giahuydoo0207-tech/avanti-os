// Backend chế độ DEMO: toàn bộ nghiệp vụ chạy trong trình duyệt, lưu localStorage.
// Dùng khi chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL trống). Luật nghiệp vụ giống hệt
// các RPC trong supabase/migrations/0002_rpc.sql để hai chế độ cho cùng kết quả.
import { addDays, CREDIT_CODES, diffDays, earlyVoidFrom, stayNights, VAT_RATE } from "../format";
import { createSeedState, STATE_VERSION } from "../seed";
import { folioOfReservation, folioTotals, roomById, roomConflict, roomTypeById } from "../selectors";
import type { ActivityLog, FolioTransaction, Guest, GuestChange, HkStatus, ISODate, PaymentMethod, PmsState, Reservation, Result, Session, ShiftTask } from "../types";
import type { ChargeInput, GuestInput, NewReservationInput, PmsActions, PmsBackend, ShiftReportInput } from "./types";

const STORAGE_KEY = "avanti-pms-state";
const uid = (p: string) => `${p}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = <T = never,>(error: string): Result<T> => ({ ok: false, error });

function loadState(today: ISODate): PmsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PmsState;
      // Dữ liệu demo được sinh theo ngày: sang ngày mới thì sinh lại để luôn có khách đến/đi hôm nay
      if (parsed.version === STATE_VERSION && parsed.seededFor === today) return parsed;
    }
  } catch { /* bỏ qua, dùng dữ liệu mẫu */ }
  return createSeedState(today);
}

function makeActions(get: () => PmsState, set: (s: PmsState) => void, session: Session, today: ISODate) {
  const now = () => new Date().toISOString();
  const actor = session.staffName;
  const log = (s: PmsState, a: Omit<ActivityLog, "id" | "branchId" | "actorName" | "createdAt">): ActivityLog[] =>
    [{ ...a, id: uid("a"), branchId: session.branchId, actorName: actor, createdAt: now() }, ...s.activities].slice(0, 300);
  const txn = (folioId: string, t: Omit<FolioTransaction, "id" | "folioId" | "postedAt" | "voided" | "voidedAt" | "postedBy" | "businessDate"> & { businessDate?: ISODate }): FolioTransaction =>
    ({ businessDate: today, ...t, id: uid("t"), folioId, postedAt: now(), voided: false, voidedAt: null, postedBy: actor });
  const guestName = (s: PmsState, r: Reservation) => s.guests.find(g => g.id === r.guestId)?.fullName ?? "Khách";
  const roomLabel = (s: PmsState, roomId: string | null) => roomById(s, roomId)?.number ?? "—";
  const commit = (s: PmsState) => { set(s); };

  return {
    createReservation(input: NewReservationInput): Result<Reservation> {
      const s = get();
      if (!input.guestId && !input.guest?.fullName.trim()) return fail("Vui lòng nhập họ tên khách");
      if (input.arrivalDate < today) return fail("Ngày đến không được trước hôm nay");
      if (diffDays(input.arrivalDate, input.departureDate) < 1) return fail("Ngày đi phải sau ngày đến ít nhất 1 đêm");
      const rt = roomTypeById(s, input.roomTypeId);
      if (!rt) return fail("Loại phòng không hợp lệ");
      if (input.adults < 1) return fail("Phải có ít nhất 1 người lớn");
      if (input.adults + input.children > rt.maxPax + 1) return fail(`Loại ${rt.code} tối đa ${rt.maxPax} khách (+1 giường phụ)`);
      if (input.rate <= 0) return fail("Giá phòng phải lớn hơn 0");
      if (input.roomId) {
        const room = roomById(s, input.roomId);
        if (!room) return fail("Phòng không tồn tại");
        if (room.hkStatus === "out_of_order") return fail(`Phòng ${room.number} đang hỏng (OOO)`);
        const c = roomConflict(s, room.id, input.arrivalDate, input.departureDate);
        if (c) return fail(`Phòng ${room.number} đã có đặt phòng #${c.confirmationNo} trùng ngày`);
      }
      let guests = s.guests;
      let guestId = input.guestId;
      if (!guestId && input.guest) {
        const g: Guest = { ...input.guest, fullName: input.guest.fullName.trim().toUpperCase(), id: uid("g"), branchId: session.branchId, createdAt: now() };
        guests = [...guests, g]; guestId = g.id;
      }
      const confirmationNo = String(s.seq.confirmation + 1);
      const folioNo = String(s.seq.folio + 1);
      const r: Reservation = {
        id: uid("r"), branchId: session.branchId, confirmationNo, guestId: guestId!, roomTypeId: rt.id, roomId: input.roomId,
        arrivalDate: input.arrivalDate, departureDate: input.departureDate, adults: input.adults, children: input.children, rate: Math.round(input.rate),
        mealPlan: input.mealPlan, source: input.source, status: input.status, note: input.note.trim(),
        checkedInAt: null, checkedOutAt: null, createdBy: actor, createdAt: now(),
      };
      const folio = { id: uid("f"), branchId: session.branchId, reservationId: r.id, folioNo, status: "open" as const, openedAt: now(), closedAt: null };
      const txns = input.deposit && input.deposit.amount > 0
        ? [txn(folio.id, { code: "DEPOSIT", kind: "credit", description: "Đặt cọc giữ phòng", amount: Math.round(input.deposit.amount), paymentMethod: input.deposit.method, ref: `#${confirmationNo}` })]
        : [];
      const name = guests.find(g => g.id === guestId)?.fullName ?? "";
      commit({
        ...s, guests, seq: { confirmation: s.seq.confirmation + 1, folio: s.seq.folio + 1 },
        reservations: [...s.reservations, r], folios: [...s.folios, folio], transactions: [...s.transactions, ...txns],
        activities: log(s, { action: "reservation.create", entityType: "reservation", entityId: r.id, message: `Đặt phòng #${confirmationNo} — ${name}${r.roomId ? ` · phòng ${roomLabel(s, r.roomId)}` : " · chưa gán phòng"}` }),
      });
      return ok(r);
    },

    updateGuest(guestId: string, patch: Partial<GuestInput>): Result {
      const s = get();
      if (patch.fullName !== undefined && !patch.fullName.trim()) return fail("Họ tên không được để trống");
      const cur = s.guests.find(g => g.id === guestId);
      if (!cur) return fail("Không tìm thấy hồ sơ khách");
      const next: Guest = { ...cur, ...patch, fullName: (patch.fullName ?? cur.fullName).trim().toUpperCase() };
      // Ghi lịch sử từng trường thay đổi (giống trigger guests_track_changes trên Supabase)
      const at = now();
      const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
      const changes: GuestChange[] = (Object.keys(next) as Array<keyof Guest>)
        .filter(k => k !== "id" && k !== "branchId" && k !== "createdAt" && str(cur[k]) !== str(next[k]))
        .map(k => ({ id: uid("gc"), branchId: cur.branchId, guestId, field: k, oldValue: str(cur[k]), newValue: str(next[k]), changedBy: actor, changedAt: at }));
      if (changes.length === 0) return ok(undefined);
      commit({ ...s, guests: s.guests.map(g => (g.id === guestId ? next : g)), guestChanges: [...changes, ...(s.guestChanges ?? [])].slice(0, 2000) });
      return ok(undefined);
    },

    assignRoom(reservationId: string, roomId: string | null): Result {
      const s = get();
      const r = s.reservations.find(x => x.id === reservationId);
      if (!r) return fail("Không tìm thấy đặt phòng");
      if (r.status !== "confirmed" && r.status !== "tentative") return fail("Chỉ gán phòng cho đặt phòng chưa nhận phòng");
      if (roomId) {
        const room = roomById(s, roomId);
        if (!room) return fail("Phòng không tồn tại");
        if (room.hkStatus === "out_of_order") return fail(`Phòng ${room.number} đang hỏng`);
        const c = roomConflict(s, roomId, r.arrivalDate, r.departureDate, r.id);
        if (c) return fail(`Phòng ${room.number} trùng lịch với đặt phòng #${c.confirmationNo}`);
      }
      commit({
        ...s, reservations: s.reservations.map(x => (x.id === r.id ? { ...x, roomId } : x)),
        activities: log(s, { action: "reservation.assign_room", entityType: "reservation", entityId: r.id, message: roomId ? `Gán phòng ${roomLabel(s, roomId)} cho #${r.confirmationNo} — ${guestName(s, r)}` : `Bỏ gán phòng #${r.confirmationNo}` }),
      });
      return ok(undefined);
    },

    /** Kéo-thả trên Room Plan: đổi phòng và/hoặc dời ngày, giữ nguyên số đêm */
    moveReservation(reservationId: string, roomId: string, arrivalDate: ISODate): Result {
      const s = get();
      const r = s.reservations.find(x => x.id === reservationId);
      if (!r) return fail("Không tìm thấy đặt phòng");
      if (r.status !== "confirmed" && r.status !== "tentative") return fail("Khách đã nhận phòng — không kéo thả được");
      if (arrivalDate < today) return fail("Không thể dời về quá khứ");
      const nights = diffDays(r.arrivalDate, r.departureDate);
      const departureDate = addDays(arrivalDate, nights);
      const room = roomById(s, roomId);
      if (!room) return fail("Phòng không tồn tại");
      if (room.hkStatus === "out_of_order") return fail(`Phòng ${room.number} đang hỏng`);
      const c = roomConflict(s, roomId, arrivalDate, departureDate, r.id);
      if (c) return fail(`Trùng lịch với #${c.confirmationNo}`);
      commit({
        ...s, reservations: s.reservations.map(x => (x.id === r.id ? { ...x, roomId, arrivalDate, departureDate } : x)),
        activities: log(s, { action: "reservation.move", entityType: "reservation", entityId: r.id, message: `Dời #${r.confirmationNo} sang phòng ${room.number}, ${arrivalDate.slice(8)}/${arrivalDate.slice(5, 7)}` }),
      });
      return ok(undefined);
    },

    cancelReservation(reservationId: string): Result {
      const s = get();
      const r = s.reservations.find(x => x.id === reservationId);
      if (!r) return fail("Không tìm thấy đặt phòng");
      if (r.status !== "confirmed" && r.status !== "tentative") return fail("Chỉ hủy được đặt phòng chưa nhận phòng");
      const folio = folioOfReservation(s, r.id);
      if (folio && folioTotals(s, folio.id).credit > 0) return fail("Folio còn tiền cọc — hoàn cọc (void giao dịch) trước khi hủy");
      commit({
        ...s, reservations: s.reservations.map(x => (x.id === r.id ? { ...x, status: "cancelled" } : x)),
        folios: s.folios.map(f => (f.reservationId === r.id ? { ...f, status: "closed", closedAt: now() } : f)),
        activities: log(s, { action: "reservation.cancel", entityType: "reservation", entityId: r.id, message: `Hủy đặt phòng #${r.confirmationNo} — ${guestName(s, r)}` }),
      });
      return ok(undefined);
    },

    checkIn(reservationId: string, deposit?: { amount: number; method: PaymentMethod }): Result {
      const s = get();
      const r = s.reservations.find(x => x.id === reservationId);
      if (!r) return fail("Không tìm thấy đặt phòng");
      if (r.status !== "confirmed" && r.status !== "tentative") return fail("Đặt phòng này không ở trạng thái chờ nhận phòng");
      if (r.arrivalDate > today) return fail(`Chưa tới ngày đến (${r.arrivalDate.slice(8)}/${r.arrivalDate.slice(5, 7)})`);
      if (r.departureDate <= today) return fail("Đặt phòng đã quá ngày đi — đánh dấu no-show hoặc sửa ngày");
      if (!r.roomId) return fail("Chưa gán phòng");
      const room = roomById(s, r.roomId)!;
      if (room.hkStatus === "out_of_order") return fail(`Phòng ${room.number} đang hỏng`);
      if (room.hkStatus === "dirty") return fail(`Phòng ${room.number} chưa dọn — đánh dấu đã dọn trước khi nhận phòng`);
      const occupant = s.reservations.find(x => x.roomId === room.id && x.status === "checked_in");
      if (occupant) return fail(`Phòng ${room.number} đang có khách ${guestName(s, occupant)}`);
      const folio = folioOfReservation(s, r.id);
      if (!folio) return fail("Không tìm thấy folio");
      const rt = roomTypeById(s, room.roomTypeId);
      // Post tiền phòng + VAT cho từng đêm còn lại của kỳ lưu trú
      const nights = stayNights(r.arrivalDate < today ? today : r.arrivalDate, r.departureDate);
      const charges = nights.flatMap(night => [
        txn(folio.id, { businessDate: night, code: "ROOM", kind: "debit", description: `Tiền phòng ${rt?.code ?? ""} đêm ${night.slice(8)}/${night.slice(5, 7)}`, amount: r.rate, paymentMethod: null, ref: room.number }),
        txn(folio.id, { businessDate: night, code: "TAX", kind: "debit", description: "VAT 8%", amount: Math.round(r.rate * VAT_RATE), paymentMethod: null, ref: "AUTO" }),
      ]);
      if (deposit && deposit.amount > 0) charges.push(txn(folio.id, { code: "DEPOSIT", kind: "credit", description: "Đặt cọc khi nhận phòng", amount: Math.round(deposit.amount), paymentMethod: deposit.method, ref: "CI" }));
      commit({
        ...s,
        reservations: s.reservations.map(x => (x.id === r.id ? { ...x, status: "checked_in", arrivalDate: r.arrivalDate < today ? today : r.arrivalDate, checkedInAt: now() } : x)),
        transactions: [...s.transactions, ...charges],
        activities: log(s, { action: "reservation.check_in", entityType: "reservation", entityId: r.id, message: `${guestName(s, r)} — check-in phòng ${room.number}` }),
      });
      return ok(undefined);
    },

    postTransaction(folioId: string, input: ChargeInput): Result {
      const s = get();
      const folio = s.folios.find(f => f.id === folioId);
      if (!folio) return fail("Không tìm thấy folio");
      if (folio.status === "closed") return fail("Folio đã đóng");
      const amount = Math.round(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) return fail("Số tiền phải lớn hơn 0");
      const kind = CREDIT_CODES.includes(input.code) ? "credit" : "debit";
      if (kind === "credit" && input.code !== "DISCOUNT" && !input.paymentMethod) return fail("Chọn hình thức thanh toán");
      const t = txn(folioId, { code: input.code, kind, description: input.description.trim() || input.code, amount, paymentMethod: kind === "credit" && input.code !== "DISCOUNT" ? input.paymentMethod ?? null : null, ref: "MANUAL" });
      const r = s.reservations.find(x => x.id === folio.reservationId);
      commit({
        ...s, transactions: [...s.transactions, t],
        activities: log(s, { action: "folio.post", entityType: "folio", entityId: folioId, message: `${kind === "debit" ? "Post" : "Thu"} ${amount.toLocaleString("vi-VN")}₫ (${t.description}) — folio #${folio.folioNo}${r ? ` · ${guestName(s, r)}` : ""}` }),
      });
      return ok(undefined);
    },

    voidTransaction(transactionId: string): Result {
      const s = get();
      const t = s.transactions.find(x => x.id === transactionId);
      if (!t) return fail("Không tìm thấy giao dịch");
      const folio = s.folios.find(f => f.id === t.folioId);
      if (folio?.status === "closed") return fail("Folio đã đóng — không void được");
      if (t.voided) return fail("Giao dịch đã void");
      commit({
        ...s, transactions: s.transactions.map(x => (x.id === t.id ? { ...x, voided: true, voidedAt: now() } : x)),
        activities: log(s, { action: "folio.void", entityType: "folio", entityId: t.folioId, message: `Void ${t.description} ${t.amount.toLocaleString("vi-VN")}₫ — folio #${folio?.folioNo}` }),
      });
      return ok(undefined);
    },

    /** Trả phòng: áp giảm giá, thu tiền, yêu cầu số dư = 0, đóng folio, phòng chuyển "chờ dọn" */
    checkOut(reservationId: string, opts: { discountPercent: number; payment: { method: PaymentMethod; amount: number } | null }): Result<{ change: number }> {
      const s = get();
      const r = s.reservations.find(x => x.id === reservationId);
      if (!r) return fail("Không tìm thấy đặt phòng");
      if (r.status !== "checked_in") return fail("Khách không ở trạng thái đang ở");
      const folio = folioOfReservation(s, r.id);
      if (!folio) return fail("Không tìm thấy folio");
      let transactions = s.transactions;
      // Trả phòng sớm: void tiền phòng các đêm chưa ở
      const early = r.departureDate > today;
      const voidFrom = earlyVoidFrom(r.arrivalDate, today);
      if (early) transactions = transactions.map(t => (t.folioId === folio.id && !t.voided && (t.code === "ROOM" || t.code === "TAX") && t.businessDate >= voidFrom ? { ...t, voided: true, voidedAt: now() } : t));
      const totals = (txs: FolioTransaction[]) => txs.filter(t => t.folioId === folio.id && !t.voided).reduce((a, t) => a + (t.kind === "debit" ? t.amount : -t.amount), 0);
      const added: FolioTransaction[] = [];
      const pct = Math.min(100, Math.max(0, opts.discountPercent || 0));
      if (pct > 0) {
        const roomCharges = transactions.filter(t => t.folioId === folio.id && !t.voided && (t.code === "ROOM" || t.code === "TAX")).reduce((a, t) => a + t.amount, 0);
        const d = Math.round((roomCharges * pct) / 100);
        if (d > 0) added.push(txn(folio.id, { code: "DISCOUNT", kind: "credit", description: `Giảm giá ${pct}% tiền phòng`, amount: d, paymentMethod: null, ref: "CO" }));
      }
      let due = totals([...transactions, ...added]);
      let change = 0;
      if (due > 0) {
        if (!opts.payment || opts.payment.amount <= 0) return fail(`Folio còn nợ ${due.toLocaleString("vi-VN")}₫ — nhập số tiền thu`);
        if (opts.payment.method !== "city_ledger" && opts.payment.amount < due) return fail(`Thu thiếu ${(due - opts.payment.amount).toLocaleString("vi-VN")}₫`);
        change = opts.payment.method === "city_ledger" ? 0 : opts.payment.amount - due;
        added.push(txn(folio.id, { code: "PAYMENT", kind: "credit", description: opts.payment.method === "city_ledger" ? "Chuyển công nợ (AR)" : "Thanh toán khi trả phòng", amount: due, paymentMethod: opts.payment.method, ref: "CO" }));
        due = 0;
      }
      if (due < 0) return fail(`Folio đang dư ${(-due).toLocaleString("vi-VN")}₫ — post khoản hoàn tiền (void cọc) trước khi trả phòng`);
      const room = roomById(s, r.roomId);
      commit({
        ...s,
        transactions: [...transactions, ...added],
        reservations: s.reservations.map(x => (x.id === r.id ? { ...x, status: "checked_out", checkedOutAt: now(), departureDate: early ? voidFrom : x.departureDate } : x)),
        folios: s.folios.map(f => (f.id === folio.id ? { ...f, status: "closed", closedAt: now() } : f)),
        rooms: s.rooms.map(x => (x.id === r.roomId ? { ...x, hkStatus: "dirty" } : x)),
        hkLogs: room ? [...s.hkLogs, { id: uid("hk"), roomId: room.id, fromStatus: room.hkStatus, toStatus: "dirty", changedBy: actor, changedAt: now() }] : s.hkLogs,
        activities: log(s, { action: "reservation.check_out", entityType: "reservation", entityId: r.id, message: `${guestName(s, r)} — check-out phòng ${room?.number ?? "—"}${early ? " (trả sớm)" : ""}` }),
      });
      return ok({ change });
    },

    setHousekeeping(roomId: string, status: HkStatus): Result {
      const s = get();
      const room = roomById(s, roomId);
      if (!room) return fail("Phòng không tồn tại");
      if (room.hkStatus === status) return ok(undefined);
      if (status === "out_of_order" && s.reservations.some(r => r.roomId === roomId && r.status === "checked_in")) return fail("Phòng đang có khách — không thể báo hỏng");
      const label = { clean: "đã dọn xong", dirty: "chờ dọn", out_of_order: "báo hỏng (OOO)" }[status];
      commit({
        ...s, rooms: s.rooms.map(x => (x.id === roomId ? { ...x, hkStatus: status } : x)),
        hkLogs: [...s.hkLogs, { id: uid("hk"), roomId, fromStatus: room.hkStatus, toStatus: status, changedBy: actor, changedAt: now() }],
        activities: log(s, { action: "room.hk_status", entityType: "room", entityId: roomId, message: `Phòng ${room.number} — ${label}` }),
      });
      return ok(undefined);
    },

    submitShiftReport(input: ShiftReportInput): Result {
      const s = get();
      if (!input.handoverToName.trim()) return fail("Nhập tên người nhận ca");
      const id = uid("sr");
      const tasks: ShiftTask[] = input.tasks.filter(t => t.content.trim()).map(t => ({ ...t, content: t.content.trim(), id: uid("st"), shiftReportId: id }));
      commit({
        ...s,
        shiftReports: [{ id, branchId: session.branchId, businessDate: input.businessDate, shift: input.shift, reporterName: actor, handoverToName: input.handoverToName.trim().toUpperCase(), cashBalance: Math.round(input.cashBalance || 0), generalNote: input.generalNote.trim(), incidentNote: input.incidentNote.trim(), status: "submitted", confirmedByName: null, confirmedAt: null, createdAt: now() }, ...s.shiftReports],
        shiftTasks: [...s.shiftTasks, ...tasks],
        activities: log(s, { action: "shift.submit", entityType: "shift_report", entityId: id, message: `Gửi báo cáo giao ca cho ${input.handoverToName.trim().toUpperCase()}` }),
      });
      return ok(undefined);
    },

    confirmShiftReport(reportId: string): Result {
      const s = get();
      const rep = s.shiftReports.find(x => x.id === reportId);
      if (!rep) return fail("Không tìm thấy báo cáo");
      if (rep.status === "confirmed") return fail("Báo cáo đã được xác nhận");
      commit({
        ...s, shiftReports: s.shiftReports.map(x => (x.id === reportId ? { ...x, status: "confirmed", confirmedByName: actor, confirmedAt: now() } : x)),
        activities: log(s, { action: "shift.confirm", entityType: "shift_report", entityId: reportId, message: `Xác nhận nhận ca từ ${rep.reporterName}` }),
      });
      return ok(undefined);
    },

    toggleShiftTask(taskId: string): void {
      const s = get();
      commit({ ...s, shiftTasks: s.shiftTasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t)) });
    },

    resetDemo(): void { commit(createSeedState(today)); },
  };
}


export function createLocalBackend(session: Session, today: ISODate): PmsBackend {
  let state: PmsState | null = null;
  const listeners = new Set<() => void>();
  const get = (): PmsState => { if (!state) state = loadState(today); return state; };
  const set = (s: PmsState) => {
    state = s;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* đầy bộ nhớ: bỏ qua */ }
    listeners.forEach(l => l());
  };
  const sync = makeActions(get, set, session, today);
  // Bọc thành Promise để cùng giao diện với backend Supabase
  const actions = Object.fromEntries(Object.entries(sync).map(([k, fn]) => [k, (...args: unknown[]) => Promise.resolve((fn as (...a: unknown[]) => unknown)(...args) ?? { ok: true, value: undefined })])) as unknown as PmsActions;
  return {
    mode: "demo",
    getSnapshot: () => get(),
    subscribe: l => { listeners.add(l); return () => { listeners.delete(l); }; },
    init: async () => { get(); },
    actions,
  };
}
