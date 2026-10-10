"use client";
import { createContext, useContext } from "react";

export type TabName = "Tổng quan" | "Tìm kiếm" | "Sơ đồ phòng" | "Room Plan" | "Đặt phòng" | "Báo cáo" | "Thu ngân" | "Room Availability" | "Hồ sơ khách";
export type OverlayKind = "checkin" | "checkout" | "folio";
export type Overlay = { kind: OverlayKind; reservationId: string } | null;

/** Dữ liệu chuyển kèm khi điều hướng giữa các tab */
export interface Intent {
  reservation?: { roomId?: string; walkIn?: boolean };
  search?: { query?: string; preset?: "arrivals" | "departures" | "inhouse"; restore?: boolean };
  profile?: { reservationId: string };
  roomId?: string;
  folioId?: string;
}

export interface NavCtx {
  tab: TabName;
  intent: Intent;
  goTo: (tab: TabName, intent?: Intent) => void;
  openOverlay: (o: Overlay) => void;
  toast: (message: string) => void;
}

export const NavContext = createContext<NavCtx | null>(null);
export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav phải nằm trong dashboard");
  return ctx;
}
