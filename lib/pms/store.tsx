"use client";
// Kho dữ liệu chung của toàn bộ dashboard Lễ tân.
// Mọi màn hình đọc cùng một `state` và chỉ thay đổi dữ liệu qua `actions`,
// nên thao tác ở tab này lập tức phản ánh ở các tab khác.
//
// Có hai backend cùng một giao diện (lib/pms/backend/types.ts):
//  - supabase.ts: dữ liệu thật trên Supabase, nghiệp vụ chạy bằng RPC (khi đã cấu hình biến môi trường)
//  - local.ts:    chế độ demo, chạy trong trình duyệt bằng localStorage
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSupabase, isSupabaseConfigured, realtimeEnabled } from "@/lib/supabase/client";
import { todayISO } from "./format";
import { createLocalBackend } from "./backend/local";
import { createSupabaseBackend } from "./backend/supabase";
import type { PmsActions, PmsBackend } from "./backend/types";
import type { ISODate, PmsState, Session } from "./types";

export type { ChargeInput, GuestInput, NewReservationInput, ShiftReportInput } from "./backend/types";

interface Ctx { state: PmsState; session: Session; today: ISODate; actions: PmsActions; mode: PmsBackend["mode"]; pending: number }
const PmsContext = createContext<Ctx | null>(null);

export function PmsProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const [today] = useState(todayISO);
  const [backend] = useState<PmsBackend>(() => isSupabaseConfigured
    ? createSupabaseBackend(getSupabase(), session, today, { realtime: realtimeEnabled })
    : createLocalBackend(session, today));
  const [error, setError] = useState<string | null>(null);
  // Đếm số thao tác đang gửi lên máy chủ để hiện "Đang lưu..."
  const [pending, setPending] = useState(0);
  const actions = useMemo(() => Object.fromEntries(Object.entries(backend.actions).map(([k, fn]) => [k, async (...args: unknown[]) => {
    setPending(n => n + 1);
    try { return await (fn as (...a: unknown[]) => Promise<unknown>)(...args); }
    catch (e) { return { ok: false, error: (e as Error).message || "Lỗi kết nối máy chủ" }; }
    finally { setPending(n => n - 1); }
  }])) as unknown as PmsActions, [backend]);
  useEffect(() => {
    backend.init().catch((e: Error) => setError(e.message));
    return () => backend.dispose?.();
  }, [backend]);
  const state = useSyncExternalStore(backend.subscribe, backend.getSnapshot, () => null);
  const value = useMemo(() => (state ? { state, session, today, actions, mode: backend.mode, pending } : null), [state, session, today, backend, actions, pending]);
  if (error) return <div className="min-h-screen flex items-center justify-center bg-[#f2f2ef] p-6"><div className="max-w-md text-[13px] text-[#c1121f] font-bold border border-[#fca5a5] bg-[#fff1f2] rounded-[3px] px-4 py-3">Không tải được dữ liệu: {error}</div></div>;
  if (!value) return <div className="min-h-screen flex items-center justify-center bg-[#f2f2ef] text-[13px] text-[#9ca3af] mono">Đang tải dữ liệu...</div>;
  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms() {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error("usePms phải nằm trong <PmsProvider>");
  return ctx;
}
