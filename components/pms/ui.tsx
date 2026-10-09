"use client";
import React from "react";
import type { ReservationStatus, RoomDisplayStatus } from "@/lib/pms/types";
import { RESERVATION_STATUS_LABEL } from "@/lib/pms/format";

const v = (name: string) => `var(--color-${name})`;

/** Màu trạng thái phòng, dùng chung cho mọi màn hình (token trong app/globals.css) */
export const ROOM_STATUS: Record<RoomDisplayStatus, { labelVi: string; cell: string; mapBg: string; mapBorder: string; mapText: string; mapSubText: string; dot: string }> = {
  clean:        { labelVi: "Trống sạch", cell: "bg-clean border-clean-ink text-white",  mapBg: v("clean-soft"), mapBorder: v("clean-line"), mapText: v("clean-ink"), mapSubText: v("clean"),     dot: v("clean") },
  occupied:     { labelVi: "Có khách",   cell: "bg-occ border-occ-line text-occ-ink",   mapBg: v("occ-soft"),   mapBorder: v("occ-line"),   mapText: v("occ-ink"),   mapSubText: v("occ-ink"),   dot: v("occ") },
  dirty:        { labelVi: "Chờ dọn",    cell: "bg-dirty border-dirty-ink text-white",  mapBg: v("dirty-soft"), mapBorder: v("dirty-line"), mapText: v("dirty-ink"), mapSubText: v("dirty"),     dot: v("dirty") },
  out_of_order: { labelVi: "Hỏng (OOO)", cell: "bg-ooo border-ooo-ink text-white",      mapBg: v("ooo-soft"),   mapBorder: v("ooo-line"),   mapText: v("ooo-ink"),   mapSubText: v("ooo"),       dot: v("ooo") },
};
export const STATUS_ORDER: RoomDisplayStatus[] = ["clean", "occupied", "dirty", "out_of_order"];

/** Đặt phòng: khách đang ở cùng màu "Có khách" trên sơ đồ phòng; đã xác nhận cùng màu "Khách đến" */
export const RES_STATUS_STYLE: Record<ReservationStatus, { bg: string; border: string; text: string }> = {
  tentative:   { bg: v("surface"),     border: v("arrive-line"), text: v("arrive-ink") },
  confirmed:   { bg: v("arrive"),      border: v("arrive-ink"),  text: "#ffffff" },
  checked_in:  { bg: v("occ"),         border: v("occ-line"),    text: v("occ-ink") },
  checked_out: { bg: v("ooo-soft"),    border: v("ooo-line"),    text: v("ooo-ink") },
  cancelled:   { bg: v("line-soft"),   border: v("line"),        text: v("muted") },
  no_show:     { bg: v("line-soft"),   border: v("line"),        text: v("muted") },
};

export function StatusDot({ status }: { status: RoomDisplayStatus }) {
  return <span aria-hidden="true" className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: ROOM_STATUS[status].dot, boxShadow: "0 0 0 2px rgb(255 255 255 / .7)" }} />;
}
export function ResBadge({ status }: { status: ReservationStatus }) {
  const c = RES_STATUS_STYLE[status];
  return <span className="inline-flex items-center text-[11px] leading-none px-1.5 py-1 rounded font-semibold whitespace-nowrap" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{RESERVATION_STATUS_LABEL[status]}</span>;
}
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-semibold text-ink mb-4 flex items-center gap-2"><span aria-hidden="true" className="w-1 h-3.5 rounded-full bg-accent inline-block" />{children}</h3>;
}
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-card shadow-[0_1px_2px_rgb(31_28_24/0.04),0_4px_12px_-6px_rgb(31_28_24/0.08)] ${className}`}>{children}</div>;
}
export function FieldRow({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="grid grid-cols-5 items-center gap-3"><label className="col-span-2 text-[12px] text-ink-2 font-medium">{label}{required && <span className="text-dirty" aria-hidden="true"> *</span>}</label><div className="col-span-3">{children}</div></div>;
}
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[11px] text-muted mb-0.5 font-medium">{label}</div><div className="mono text-[13px] font-semibold text-ink">{value}</div></div>;
}
export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="border border-dirty-line bg-dirty-soft rounded-ctl px-4 py-2.5 text-[12px] text-dirty-ink font-semibold">{message}</div>;
}
export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-5 py-10 text-center text-[13px] text-muted font-medium">{text}</td></tr>;
}
export function OverlayHeader({ title, onBack, children }: { title: React.ReactNode; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="bg-surface/90 backdrop-blur border-b border-line flex items-center justify-between px-7 shrink-0 sticky top-0 z-10" style={{ height: 56 }}>
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink font-semibold transition-colors rounded px-1 -ml-1">← Quay lại</button>
        <span aria-hidden="true" className="w-px h-4 bg-line" />
        <h2 className="text-[14px] font-semibold text-ink truncate">{title}</h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

export const inputCls = "w-full border border-line rounded-ctl px-3 py-2 text-[13px] font-medium text-ink outline-none bg-sunken placeholder:text-faint hover:border-line-strong focus:border-accent focus:bg-surface focus:ring-3 focus:ring-accent/15 transition-[border-color,background-color,box-shadow] disabled:opacity-50";
export const selectCls = inputCls;
export const textareaCls = `${inputCls} resize-none`;
