"use client";
import React from "react";
import type { ReservationStatus, RoomDisplayStatus } from "@/lib/pms/types";
import { RESERVATION_STATUS_LABEL } from "@/lib/pms/format";

export const ROOM_STATUS: Record<RoomDisplayStatus, { labelVi: string; cell: string; mapBg: string; mapBorder: string; mapText: string; mapSubText: string; dot: string }> = {
  clean:        { labelVi: "Trống sạch", cell: "bg-[#2d6a4f] border-[#1b4332]", mapBg: "#f0fdf4", mapBorder: "#86efac", mapText: "#14532d", mapSubText: "#15803d", dot: "#22c55e" },
  occupied:     { labelVi: "Có khách",   cell: "bg-[#d4a017] border-[#a37c00]", mapBg: "#fffbeb", mapBorder: "#fcd34d", mapText: "#78350f", mapSubText: "#92400e", dot: "#f59e0b" },
  dirty:        { labelVi: "Chờ dọn",    cell: "bg-[#c1121f] border-[#8b0000]", mapBg: "#fff1f2", mapBorder: "#fca5a5", mapText: "#7f1d1d", mapSubText: "#991b1b", dot: "#ef4444" },
  out_of_order: { labelVi: "Hỏng (OOO)", cell: "bg-[#6b7280] border-[#4b5563]", mapBg: "#f3f4f6", mapBorder: "#d1d5db", mapText: "#374151", mapSubText: "#6b7280", dot: "#9ca3af" },
};
export const STATUS_ORDER: RoomDisplayStatus[] = ["clean", "occupied", "dirty", "out_of_order"];

export const RES_STATUS_STYLE: Record<ReservationStatus, { bg: string; border: string; text: string }> = {
  tentative:   { bg: "#f97316", border: "#c2410c", text: "#fff" },
  confirmed:   { bg: "#3b82f6", border: "#1d4ed8", text: "#fff" },
  checked_in:  { bg: "#8b5cf6", border: "#6d28d9", text: "#fff" },
  checked_out: { bg: "#94a3b8", border: "#64748b", text: "#fff" },
  cancelled:   { bg: "#e5e7eb", border: "#d1d5db", text: "#6b7280" },
  no_show:     { bg: "#e5e7eb", border: "#d1d5db", text: "#6b7280" },
};

export function StatusDot({ status }: { status: RoomDisplayStatus }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: ROOM_STATUS[status].dot, boxShadow: "0 0 0 1.5px rgba(0,0,0,0.12)" }} />;
}
export function ResBadge({ status }: { status: ReservationStatus }) {
  const c = RES_STATUS_STYLE[status];
  return <span className="text-[11px] px-1.5 py-0.5 rounded-[2px] font-bold whitespace-nowrap" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{RESERVATION_STATUS_LABEL[status]}</span>;
}
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block" />{children}</h3>;
}
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] ${className}`}>{children}</div>;
}
export function FieldRow({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="grid grid-cols-5 items-center gap-3"><label className="col-span-2 text-[12px] text-[#6b7280] font-semibold">{label}{required && <span className="text-[#c1121f]"> *</span>}</label><div className="col-span-3">{children}</div></div>;
}
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">{label}</div><div className="mono text-[13px] font-bold text-[#1a1a1a]">{value}</div></div>;
}
export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="border border-[#fca5a5] bg-[#fff1f2] rounded-[3px] px-4 py-2.5 text-[12px] text-[#c1121f] font-bold">{message}</div>;
}
export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-5 py-8 text-center text-[13px] text-[#9ca3af] font-semibold">{text}</td></tr>;
}
export function OverlayHeader({ title, onBack, children }: { title: React.ReactNode; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 sticky top-0 z-10" style={{ height: 56 }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors">← Quay lại</button>
        <span className="text-[#e5e7eb]">|</span>
        <span className="text-[13px] font-bold text-[#1a1a1a]">{title}</span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export const inputCls = "w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] focus:ring-2 focus:ring-[#6b7280]/10 transition-all bg-[#fafafa] disabled:opacity-50";
export const selectCls = inputCls;
export const textareaCls = "w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none";
