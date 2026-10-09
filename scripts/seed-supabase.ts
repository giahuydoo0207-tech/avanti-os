// Nạp dữ liệu mẫu vào Supabase (XÓA toàn bộ dữ liệu cũ của các bảng nghiệp vụ).
// Chạy:  npm run seed:supabase
// Cần biến môi trường (đặt trong .env.local):
//   NEXT_PUBLIC_SUPABASE_URL=...         SUPABASE_SERVICE_ROLE_KEY=...   (Settings → API, KHÔNG đưa key này lên frontend)
// Tạo sẵn 3 tài khoản lễ tân (tên đăng nhập + mã PIN 6 số), xem lib/pms/staff-login.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createSeedState } from "../lib/pms/seed";
import { DEMO_STAFF, STAFF_LOGIN_DOMAIN, usernameToEmail } from "../lib/pms/staff-login";

// Đọc .env.local nếu có (không cần thư viện dotenv)
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* không có .env.local */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const STAFF = DEMO_STAFF.map(st => ({ ...st, email: usernameToEmail(st.username) }));

const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // ngày theo giờ Việt Nam
const ids = new Map<string, string>();
const uuid = (key: string) => { let v = ids.get(key); if (!v) { v = crypto.randomUUID(); ids.set(key, v); } return v; };
const ref = (key: string | null) => (key ? uuid(key) : null);

type Res = { data: unknown; error: { message: string } | null };
async function check<R extends Res>(p: PromiseLike<R>, what: string): Promise<Exclude<R, { error: { message: string } }>["data"]> {
  const r = await p;
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as Exclude<R, { error: { message: string } }>["data"];
}
async function insert(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) await check(sb.from(table).insert(rows.slice(i, i + 500)), `insert ${table}`);
  console.log(`  ${table}: ${rows.length}`);
}

async function ensureUser(email: string, password: string, fullName: string): Promise<string> {
  const list = await check(sb.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers");
  const found = list.users.find(u => u.email === email);
  if (found) {
    // đặt lại mã PIN cho tài khoản đã có
    await check(sb.auth.admin.updateUserById(found.id, { password, user_metadata: { full_name: fullName } }), `updateUser ${email}`);
    return found.id;
  }
  const created = await check(sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }), `createUser ${email}`);
  return created.user!.id;
}

/** Xóa các tài khoản mẫu cũ (đăng nhập bằng email trước đây) để khỏi nhầm */
async function removeOldDemoUsers() {
  const keep = new Set(STAFF.map(st => st.email));
  const list = await check(sb.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers");
  for (const u of list.users) {
    if (u.email?.endsWith(`@${STAFF_LOGIN_DOMAIN}`) && !keep.has(u.email)) {
      await check(sb.auth.admin.deleteUser(u.id), `deleteUser ${u.email}`);
      console.log(`  đã xóa tài khoản cũ ${u.email}`);
    }
  }
}

async function main() {
  console.log(`Nạp dữ liệu mẫu cho ngày ${today} vào ${url}`);
  const s = createSeedState(today);

  console.log("Xóa dữ liệu cũ...");
  const none = "00000000-0000-0000-0000-000000000000";
  for (const t of ["activity_logs", "shift_tasks", "shift_reports", "housekeeping_logs", "folio_transactions", "folios", "reservations", "guests", "rooms", "room_types", "staff_profiles", "branches"])
    await check(sb.from(t).delete().neq("id", none), `delete ${t}`);

  console.log("Thêm dữ liệu...");
  await insert("branches", s.branches.map(b => ({ id: uuid(b.id), code: b.code, name: b.name, address: b.address, stars: b.stars })));
  const staffIds: Record<string, string> = {};
  await removeOldDemoUsers();
  for (const st of STAFF) staffIds[st.email] = await ensureUser(st.email, st.pin, st.fullName);
  await insert("staff_profiles", STAFF.map(st => ({ id: staffIds[st.email], branch_id: uuid(st.branch), full_name: st.fullName, role: "front_desk" })));
  await insert("room_types", s.roomTypes.map(t => ({ id: uuid(t.id), branch_id: uuid(t.branchId), code: t.code, name: t.name, base_rate: t.baseRate, max_pax: t.maxPax })));
  await insert("rooms", s.rooms.map(r => ({ id: uuid(r.id), branch_id: uuid(r.branchId), room_type_id: uuid(r.roomTypeId), number: r.number, floor: r.floor, hk_status: r.hkStatus })));
  await insert("guests", s.guests.map(g => ({
    id: uuid(g.id), branch_id: uuid(g.branchId), guest_type: g.guestType, full_name: g.fullName, nationality: g.nationality, id_type: g.idType,
    id_number: g.idNumber, id_issued_date: g.idIssuedDate, id_issued_place: g.idIssuedPlace, id_expiry_date: g.idExpiryDate, dob: g.dob, gender: g.gender,
    phone: g.phone, email: g.email, address: g.address, company: g.company, visa_type: g.visaType, visa_number: g.visaNumber,
    visa_expiry: g.visaExpiry, entry_date: g.entryDate, port_of_entry: g.portOfEntry,
  })));
  await insert("reservations", s.reservations.map(r => ({
    id: uuid(r.id), branch_id: uuid(r.branchId), confirmation_no: r.confirmationNo, guest_id: uuid(r.guestId), room_type_id: uuid(r.roomTypeId),
    room_id: ref(r.roomId), arrival_date: r.arrivalDate, departure_date: r.departureDate, adults: r.adults, children: r.children, rate: r.rate,
    meal_plan: r.mealPlan, source: r.source, status: r.status, note: r.note, checked_in_at: r.checkedInAt, checked_out_at: r.checkedOutAt,
  })));
  await insert("folios", s.folios.map(f => ({ id: uuid(f.id), branch_id: uuid(f.branchId), reservation_id: uuid(f.reservationId), folio_no: f.folioNo, status: f.status, opened_at: f.openedAt, closed_at: f.closedAt })));
  await insert("folio_transactions", s.transactions.map(t => ({
    id: uuid(t.id), folio_id: uuid(t.folioId), business_date: t.businessDate, posted_at: t.postedAt, code: t.code, kind: t.kind,
    description: t.description, amount: t.amount, payment_method: t.paymentMethod, ref: t.ref, voided: t.voided, voided_at: t.voidedAt,
  })));
  const reporter = (name: string) => STAFF.find(x => x.fullName === name);
  await insert("shift_reports", s.shiftReports.map(r => ({
    id: uuid(r.id), branch_id: uuid(r.branchId), business_date: r.businessDate, shift: r.shift,
    reporter_id: staffIds[(reporter(r.reporterName) ?? STAFF[0]).email], handover_to_name: r.handoverToName, cash_balance: r.cashBalance,
    general_note: r.generalNote, incident_note: r.incidentNote, status: r.status,
    confirmed_by: r.confirmedByName ? staffIds[(reporter(r.confirmedByName) ?? STAFF[1]).email] : null, confirmed_at: r.confirmedAt,
  })));
  await insert("shift_tasks", s.shiftTasks.map(t => ({ id: uuid(t.id), shift_report_id: uuid(t.shiftReportId), content: t.content, priority: t.priority, done: t.done })));
  await insert("activity_logs", s.activities.map(a => ({ branch_id: uuid(a.branchId), action: a.action, entity_type: a.entityType, message: a.message })));

  console.log("\nXong. Tài khoản lễ tân:");
  for (const st of STAFF) console.log(`  Tên đăng nhập: ${st.username.padEnd(6)}  Mã PIN: ${st.pin}   ${st.fullName} (${st.branchName})`);
}

main().catch(e => { console.error("Lỗi:", e.message); process.exit(1); });
