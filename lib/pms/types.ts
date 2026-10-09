// Kiểu dữ liệu nghiệp vụ của Avanti OS.
// Mỗi kiểu ánh xạ 1-1 với một bảng Supabase trong supabase/migrations/0001_init.sql
// (camelCase ở frontend  <->  snake_case ở Postgres).

export type ISODate = string; // "YYYY-MM-DD" theo giờ địa phương
export type ISODateTime = string; // new Date().toISOString()

export type HkStatus = "clean" | "dirty" | "out_of_order";
/** Trạng thái hiển thị trên sơ đồ = hk_status + có khách đang ở hay không */
export type RoomDisplayStatus = "occupied" | HkStatus;

export type ReservationStatus =
  | "tentative"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type GuestType = "vietnamese" | "foreign";
export type IdType = "cccd" | "passport";
export type Gender = "male" | "female" | "other";
export type MealPlan = "RO" | "BB" | "HB" | "FB";
export type BookingSource = "Direct" | "Walk-in" | "Booking.com" | "Agoda" | "Expedia" | "Traveloka" | "Travel Agent";

export type TxnKind = "debit" | "credit";
export type TxnCode =
  | "ROOM" | "TAX" | "MINIBAR" | "LAUNDRY" | "RESTAURANT" | "TRANSPORT" | "SPA" | "MISC" // phát sinh (debit)
  | "DEPOSIT" | "PAYMENT" | "DISCOUNT"; // thanh toán / giảm trừ (credit)
export type PaymentMethod = "cash_vnd" | "cash_usd" | "card" | "bank_transfer" | "city_ledger";

export type ShiftName = "morning" | "afternoon" | "night";
export type TaskPriority = "urgent" | "normal" | "info";

export interface Branch { id: string; code: string; name: string; address: string; stars: number }

export interface RoomType {
  id: string; branchId: string; code: string; name: string;
  baseRate: number; // VND / đêm
  maxPax: number;
}

export interface Room {
  id: string; branchId: string; roomTypeId: string;
  number: string; floor: number; hkStatus: HkStatus;
}

export interface Guest {
  id: string; branchId: string; guestType: GuestType; fullName: string;
  nationality: string; // ISO 3166 alpha-2, "VN" cho khách Việt
  idType: IdType; idNumber: string; idIssuedDate: ISODate | null; idIssuedPlace: string; idExpiryDate: ISODate | null;
  dob: ISODate | null; gender: Gender | null;
  phone: string; email: string; address: string; company: string;
  // Khai báo tạm trú (PC06) cho khách nước ngoài
  visaType: string; visaNumber: string; visaExpiry: ISODate | null; entryDate: ISODate | null; portOfEntry: string;
  createdAt: ISODateTime;
}

export interface Reservation {
  id: string; branchId: string; confirmationNo: string;
  guestId: string; roomTypeId: string; roomId: string | null;
  arrivalDate: ISODate; departureDate: ISODate; // đêm cuối = departureDate - 1
  adults: number; children: number; rate: number; mealPlan: MealPlan; source: BookingSource;
  status: ReservationStatus; note: string;
  checkedInAt: ISODateTime | null; checkedOutAt: ISODateTime | null;
  createdBy: string; createdAt: ISODateTime;
}

export interface Folio {
  id: string; branchId: string; reservationId: string; folioNo: string;
  status: "open" | "closed"; openedAt: ISODateTime; closedAt: ISODateTime | null;
}

export interface FolioTransaction {
  id: string; folioId: string; businessDate: ISODate; postedAt: ISODateTime;
  code: TxnCode; kind: TxnKind; description: string; amount: number; // luôn > 0, VND
  paymentMethod: PaymentMethod | null; ref: string;
  voided: boolean; voidedAt: ISODateTime | null; postedBy: string;
}

export interface HousekeepingLog {
  id: string; roomId: string; fromStatus: HkStatus; toStatus: HkStatus; changedBy: string; changedAt: ISODateTime;
}

export interface ShiftTask { id: string; shiftReportId: string; content: string; priority: TaskPriority; done: boolean }

export interface ShiftReport {
  id: string; branchId: string; businessDate: ISODate; shift: ShiftName;
  reporterName: string; handoverToName: string; cashBalance: number;
  generalNote: string; incidentNote: string;
  status: "submitted" | "confirmed"; confirmedByName: string | null; confirmedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface ActivityLog {
  id: string; branchId: string; actorName: string; action: string; message: string;
  entityType: "reservation" | "room" | "folio" | "shift_report"; entityId: string; createdAt: ISODateTime;
}

export interface PmsState {
  version: number;
  seededFor: ISODate; // ngày tạo dữ liệu mẫu
  seq: { confirmation: number; folio: number };
  branches: Branch[];
  roomTypes: RoomType[];
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  folios: Folio[];
  transactions: FolioTransaction[];
  hkLogs: HousekeepingLog[];
  shiftReports: ShiftReport[];
  shiftTasks: ShiftTask[];
  activities: ActivityLog[];
}

export interface Session { staffName: string; branchId: string; userId?: string }

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
