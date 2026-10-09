// Các phép tính chỉ đọc trên state. Mọi màn hình dùng chung các hàm này
// nên số liệu giữa Tổng quan, Sơ đồ phòng, Room Plan, Availability luôn khớp nhau.
import { addDays, localDateOf, overlaps } from "./format";
import type { FolioTransaction, ISODate, PmsState, Reservation, Room, RoomDisplayStatus, RoomType } from "./types";

export const ACTIVE_STATUSES: Reservation["status"][] = ["tentative", "confirmed", "checked_in"];
export const isActive = (r: Reservation) => ACTIVE_STATUSES.includes(r.status);

export const branchRooms = (s: PmsState, branchId: string) =>
  s.rooms.filter(r => r.branchId === branchId).sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number));
export const branchRoomTypes = (s: PmsState, branchId: string) => s.roomTypes.filter(t => t.branchId === branchId);
export const branchReservations = (s: PmsState, branchId: string) => s.reservations.filter(r => r.branchId === branchId);

export const roomTypeById = (s: PmsState, id: string): RoomType | undefined => s.roomTypes.find(t => t.id === id);
export const roomById = (s: PmsState, id: string | null): Room | undefined => (id ? s.rooms.find(r => r.id === id) : undefined);
export const guestById = (s: PmsState, id: string) => s.guests.find(g => g.id === id);
export const reservationById = (s: PmsState, id: string) => s.reservations.find(r => r.id === id);
export const folioOfReservation = (s: PmsState, reservationId: string) => s.folios.find(f => f.reservationId === reservationId);

/** Khách đang ở theo phòng */
export function inHouseByRoom(s: PmsState, branchId: string): Map<string, Reservation> {
  const m = new Map<string, Reservation>();
  s.reservations.forEach(r => { if (r.branchId === branchId && r.status === "checked_in" && r.roomId) m.set(r.roomId, r); });
  return m;
}

export function displayStatus(room: Room, inHouse: Map<string, Reservation>): RoomDisplayStatus {
  if (inHouse.has(room.id)) return "occupied";
  return room.hkStatus;
}

export function folioTransactions(s: PmsState, folioId: string, includeVoided = false): FolioTransaction[] {
  return s.transactions.filter(t => t.folioId === folioId && (includeVoided || !t.voided))
    .sort((a, b) => a.businessDate.localeCompare(b.businessDate) || a.postedAt.localeCompare(b.postedAt));
}
export function folioTotals(s: PmsState, folioId: string) {
  let debit = 0, credit = 0;
  s.transactions.forEach(t => { if (t.folioId === folioId && !t.voided) { if (t.kind === "debit") debit += t.amount; else credit += t.amount; } });
  return { debit, credit, balance: debit - credit };
}

/** Các phòng trống (không trùng lịch, không hỏng) cho khoảng [arrival, departure) */
export function freeRooms(s: PmsState, branchId: string, arrival: ISODate, departure: ISODate, opts: { roomTypeId?: string | null; excludeReservationId?: string } = {}): Room[] {
  const busy = new Set(
    s.reservations.filter(r => r.branchId === branchId && isActive(r) && r.roomId && r.id !== opts.excludeReservationId && overlaps(r.arrivalDate, r.departureDate, arrival, departure))
      .map(r => r.roomId as string),
  );
  return branchRooms(s, branchId).filter(room => room.hkStatus !== "out_of_order" && !busy.has(room.id) && (!opts.roomTypeId || room.roomTypeId === opts.roomTypeId));
}

/** Đặt phòng khác đang chiếm phòng này trong khoảng ngày (nếu có) */
export function roomConflict(s: PmsState, roomId: string, arrival: ISODate, departure: ISODate, excludeReservationId?: string) {
  return s.reservations.find(r => r.roomId === roomId && r.id !== excludeReservationId && isActive(r) && overlaps(r.arrivalDate, r.departureDate, arrival, departure));
}

export function dashboardStats(s: PmsState, branchId: string, today: ISODate) {
  const rooms = branchRooms(s, branchId);
  const inHouse = inHouseByRoom(s, branchId);
  const res = branchReservations(s, branchId);
  let occupied = 0, clean = 0, dirty = 0, ooo = 0;
  rooms.forEach(r => { const st = displayStatus(r, inHouse); if (st === "occupied") occupied++; else if (st === "clean") clean++; else if (st === "dirty") dirty++; else ooo++; });
  const arrivalsToday = res.filter(r => r.arrivalDate === today && r.status !== "cancelled" && r.status !== "no_show");
  const arrivalsPending = arrivalsToday.filter(r => r.status === "confirmed" || r.status === "tentative");
  const departuresToday = res.filter(r => r.departureDate === today && (r.status === "checked_in" || r.status === "checked_out"));
  const departuresPending = departuresToday.filter(r => r.status === "checked_in");
  const unassigned = res.filter(r => !r.roomId && (r.status === "confirmed" || r.status === "tentative")).sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  const saleable = rooms.length - ooo;
  return {
    total: rooms.length, occupied, clean, dirty, ooo, saleable,
    occupancyPct: saleable ? Math.round((occupied / saleable) * 100) : 0,
    arrivalsToday, arrivalsPending, departuresToday, departuresPending, unassigned,
  };
}

/** Bảng availability theo loại phòng x ngày */
export function availabilityGrid(s: PmsState, branchId: string, start: ISODate, days: number, includeTentative: boolean) {
  const types = branchRoomTypes(s, branchId);
  const rooms = branchRooms(s, branchId);
  const res = branchReservations(s, branchId).filter(r => r.status === "confirmed" || r.status === "checked_in" || (includeTentative && r.status === "tentative"));
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const typeOfReservation = (r: Reservation) => (r.roomId ? rooms.find(x => x.id === r.roomId)?.roomTypeId ?? r.roomTypeId : r.roomTypeId);
  const rows = types.map(t => {
    const total = rooms.filter(r => r.roomTypeId === t.id && r.hkStatus !== "out_of_order").length;
    const sold = dates.map(d => res.filter(r => typeOfReservation(r) === t.id && r.arrivalDate <= d && d < r.departureDate).length);
    return { type: t, total, sold, available: sold.map(x => total - x) };
  });
  const saleable = rows.reduce((a, r) => a + r.total, 0);
  const soldTotal = dates.map((_, i) => rows.reduce((a, r) => a + r.sold[i], 0));
  const arrivals = dates.map(d => res.filter(r => r.arrivalDate === d).length);
  const departures = dates.map(d => branchReservations(s, branchId).filter(r => r.departureDate === d && (r.status === "confirmed" || r.status === "checked_in" || r.status === "checked_out")).length);
  return { dates, rows, saleable, soldTotal, arrivals, departures, ooo: rooms.filter(r => r.hkStatus === "out_of_order").length };
}

export function txnsOnDate(s: PmsState, branchId: string, date: ISODate) {
  const folioIds = new Set(s.folios.filter(f => f.branchId === branchId).map(f => f.id));
  return s.transactions.filter(t => folioIds.has(t.folioId) && !t.voided && localDateOf(t.postedAt) === date)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
