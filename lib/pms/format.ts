import type { ISODate, PaymentMethod, ReservationStatus, ShiftName, TxnCode } from "./types";

// ─── Ngày (chuỗi YYYY-MM-DD, tính bằng UTC để không lệch múi giờ) ───
const toUTC = (d: ISODate) => { const [y, m, day] = d.split("-").map(Number); return Date.UTC(y, m - 1, day); };
const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export function todayISO(): ISODate { return localDateOf(new Date().toISOString()); }
/** Ngày địa phương của một mốc thời gian ISO */
export function localDateOf(iso: string): ISODate {
  const n = new Date(iso);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
export const addDays = (d: ISODate, n: number): ISODate => fromUTC(toUTC(d) + n * 86400000);
/** b - a, tính theo ngày */
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const isWeekend = (d: ISODate) => { const w = new Date(toUTC(d)).getUTCDay(); return w === 0 || w === 6; };
export const weekdayShort = (d: ISODate) => ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(toUTC(d)).getUTCDay()];
export const fmtDate = (d: ISODate | null | undefined) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
export const fmtDayMonth = (d: ISODate) => { const [, m, day] = d.split("-"); return `${Number(day)}/${Number(m)}`; };
/** Danh sách các đêm lưu trú: arrival .. departure-1 */
export const stayNights = (arrival: ISODate, departure: ISODate): ISODate[] =>
  Array.from({ length: Math.max(0, diffDays(arrival, departure)) }, (_, i) => addDays(arrival, i));
/** Trả phòng sớm: void tiền phòng từ đêm này trở đi (luôn giữ đêm đầu tiên) */
export const earlyVoidFrom = (arrival: ISODate, today: ISODate): ISODate => { const a1 = addDays(arrival, 1); return a1 > today ? a1 : today; };
/** Hai khoảng [a1,d1) và [a2,d2) có chồng nhau không */
export const overlaps = (a1: ISODate, d1: ISODate, a2: ISODate, d2: ISODate) => a1 < d2 && a2 < d1;

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—");

// ─── Tiền ───
export const money = (n: number) => n.toLocaleString("vi-VN");
export const VAT_RATE = 0.08;

// ─── Nhãn hiển thị ───
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  tentative: "Tentative", confirmed: "Confirmed", checked_in: "Đang ở", checked_out: "Đã trả phòng", cancelled: "Đã hủy", no_show: "No-show",
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash_vnd: "Tiền mặt (VND)", cash_usd: "Tiền mặt (USD)", card: "Thẻ", bank_transfer: "Chuyển khoản", city_ledger: "Công nợ (AR)",
};
export const SHIFT_LABEL: Record<ShiftName, string> = { morning: "Ca sáng", afternoon: "Ca chiều", night: "Ca tối" };
export const TXN_CODE_LABEL: Record<TxnCode, string> = {
  ROOM: "Tiền phòng", TAX: "VAT 8%", MINIBAR: "Minibar", LAUNDRY: "Giặt ủi", RESTAURANT: "Nhà hàng", TRANSPORT: "Đưa đón", SPA: "Spa", MISC: "Khác",
  DEPOSIT: "Đặt cọc", PAYMENT: "Thanh toán", DISCOUNT: "Giảm giá",
};
export const CREDIT_CODES: TxnCode[] = ["DEPOSIT", "PAYMENT", "DISCOUNT"];
export const CHARGE_CODES: TxnCode[] = ["MINIBAR", "LAUNDRY", "RESTAURANT", "TRANSPORT", "SPA", "MISC"];
