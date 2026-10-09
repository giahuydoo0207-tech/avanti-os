import type { BookingSource, Guest, HkStatus, ISODate, MealPlan, PaymentMethod, PmsState, Reservation, Result, ShiftName, TaskPriority, TxnCode } from "../types";

export type GuestInput = Omit<Guest, "id" | "branchId" | "createdAt">;
export interface NewReservationInput {
  guestId?: string; guest?: GuestInput;
  roomTypeId: string; roomId: string | null; arrivalDate: ISODate; departureDate: ISODate;
  adults: number; children: number; rate: number; mealPlan: MealPlan; source: BookingSource;
  status: "confirmed" | "tentative"; note: string;
  deposit?: { amount: number; method: PaymentMethod };
}
export interface ChargeInput { code: TxnCode; description: string; amount: number; paymentMethod?: PaymentMethod | null }
export interface ShiftReportInput {
  businessDate: ISODate; shift: ShiftName; handoverToName: string; cashBalance: number; generalNote: string; incidentNote: string;
  tasks: Array<{ content: string; priority: TaskPriority; done: boolean }>;
}


/** Mọi thao tác nghiệp vụ. Hai bản cài đặt: local.ts (demo) và supabase.ts (RPC thật) */
export interface PmsActions {
  createReservation(input: NewReservationInput): Promise<Result<Pick<Reservation, "id">>>;
  updateGuest(guestId: string, patch: Partial<GuestInput>): Promise<Result>;
  assignRoom(reservationId: string, roomId: string | null): Promise<Result>;
  moveReservation(reservationId: string, roomId: string, arrivalDate: ISODate): Promise<Result>;
  cancelReservation(reservationId: string): Promise<Result>;
  checkIn(reservationId: string, deposit?: { amount: number; method: PaymentMethod }): Promise<Result>;
  postTransaction(folioId: string, input: ChargeInput): Promise<Result>;
  voidTransaction(transactionId: string): Promise<Result>;
  checkOut(reservationId: string, opts: { discountPercent: number; payment: { method: PaymentMethod; amount: number } | null }): Promise<Result<{ change: number }>>;
  setHousekeeping(roomId: string, status: HkStatus): Promise<Result>;
  submitShiftReport(input: ShiftReportInput): Promise<Result>;
  confirmShiftReport(reportId: string): Promise<Result>;
  toggleShiftTask(taskId: string): Promise<Result>;
  resetDemo(): Promise<Result>;
}

export interface PmsBackend {
  mode: "demo" | "supabase";
  getSnapshot(): PmsState | null;
  subscribe(listener: () => void): () => void;
  /** Tải dữ liệu lần đầu */
  init(): Promise<void>;
  actions: PmsActions;
  dispose?(): void;
}
