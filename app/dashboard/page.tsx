"use client";
// Màn hình chính của Lễ tân. Toàn bộ tab đọc/ghi qua một kho dữ liệu chung (lib/pms/store.tsx)
// nên mọi thao tác (đặt phòng → check-in → folio → check-out → dọn phòng → giao ca) liên thông với nhau.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, BedDouble, CalendarDays, ChevronRight, ClipboardList, DollarSign, Home, LayoutGrid, LogOut, RotateCcw, Search, Table2 } from "lucide-react";
import { PmsProvider, usePms } from "@/lib/pms/store";
import { dashboardStats } from "@/lib/pms/selectors";
import type { Session } from "@/lib/pms/types";
import { Intent, NavContext, Overlay, TabName } from "@/components/pms/nav";
import { CheckInOverlay, CheckOutOverlay, FolioOverlay } from "@/components/pms/overlays";
import { OverviewTab } from "@/components/pms/tabs/overview";
import { SearchTab } from "@/components/pms/tabs/search";
import { RoomMapTab } from "@/components/pms/tabs/room-map";
import { RoomPlanTab } from "@/components/pms/tabs/room-plan";
import { ReservationTab } from "@/components/pms/tabs/reservation";
import { ShiftReportTab } from "@/components/pms/tabs/shift-report";
import { CashierTab } from "@/components/pms/tabs/cashier";
import { AvailabilityTab } from "@/components/pms/tabs/availability";

const MENU: Array<{ name: TabName; icon: React.ElementType }> = [
  { name: "Tổng quan", icon: Home }, { name: "Tìm kiếm", icon: Search }, { name: "Sơ đồ phòng", icon: LayoutGrid },
  { name: "Room Plan", icon: CalendarDays }, { name: "Đặt phòng", icon: BedDouble }, { name: "Thu ngân", icon: DollarSign },
  { name: "Room Availability", icon: Table2 }, { name: "Báo cáo", icon: ClipboardList },
];

function Shell() {
  const { state, session, today, actions } = usePms();
  const [tab, setTab] = useState<TabName>("Tổng quan");
  const [intent, setIntent] = useState<Intent>({});
  const [navKey, setNavKey] = useState(0);
  const [overlays, setOverlays] = useState<NonNullable<Overlay>[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Mỗi lần điều hướng, tab được mount lại và tự khởi tạo từ `intent`
  const goTo = useCallback((t: TabName, i: Intent = {}) => { setTab(t); setIntent(i); setNavKey(k => k + 1); setOverlays([]); }, []);
  // Overlay xếp chồng: ví dụ Check-out → mở Folio → Quay lại về Check-out
  const openOverlay = useCallback((o: Overlay) => setOverlays(prev => (o ? [...prev.filter(x => !(x.kind === o.kind && x.reservationId === o.reservationId)), o] : [])), []);
  const closeTop = () => setOverlays(prev => prev.slice(0, -1));
  const toast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2500); }, []);
  const nav = useMemo(() => ({ tab, intent, goTo, openOverlay, toast }), [tab, intent, goTo, openOverlay, toast]);

  const branch = state.branches.find(b => b.id === session.branchId);
  const st = dashboardStats(state, session.branchId, today);
  const top = overlays[overlays.length - 1];
  const initials = session.staffName.split(" ").filter(Boolean).slice(-2).map(w => w[0]).join("") || "LT";

  const logout = () => { try { localStorage.removeItem("staffName"); localStorage.removeItem("staffRole"); localStorage.removeItem("branchId"); } catch { /* */ } window.location.href = "/"; };
  const reset = () => { if (window.confirm("Khôi phục toàn bộ dữ liệu demo về ban đầu? Mọi thao tác đã làm sẽ mất.")) { actions.resetDemo(); goTo("Tổng quan"); toast("Đã khôi phục dữ liệu demo"); } };

  return (
    <NavContext.Provider value={nav}>
      <div className="flex min-h-screen bg-[#f2f2ef] text-[#1a1a1a]" style={{ fontWeight: 500 }}>
        <aside className="w-52 shrink-0 flex flex-col bg-[#0f0f0e] text-white sticky top-0 h-screen">
          <div className="px-5 py-4 border-b border-[#252523]">
            <div className="text-[9px] tracking-[0.2em] text-[#5c5c58] uppercase mb-0.5 font-bold">Avanti OS · Lễ tân</div>
            <div className="text-[15px] font-bold tracking-tight leading-tight">{branch?.name}</div>
            <div className="mono text-[11px] text-[#5c5c58] mt-0.5">{st.total} phòng · {"★".repeat(branch?.stars ?? 0)}</div>
            <div className="mono text-[11px] text-[#5c5c58] mt-1">{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</div>
          </div>
          <nav className="flex-1 py-2">
            {MENU.map(({ name, icon: Icon }) => (
              <button key={name} onClick={() => goTo(name)} className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-all text-[13px] ${tab === name ? "text-white bg-[#252523] border-l-2 border-white" : "text-[#7a7a75] hover:text-white hover:bg-[#1c1c1a] border-l-2 border-transparent"}`}>
                <Icon size={15} strokeWidth={tab === name ? 2 : 1.5} /><span className="font-bold flex-1">{name}</span>
                {name === "Tìm kiếm" && st.arrivalsPending.length + st.departuresPending.length > 0 && <span className="mono text-[10px] bg-[#252523] text-[#e9c46a] px-1.5 rounded-[2px]">{st.arrivalsPending.length + st.departuresPending.length}</span>}
                {name === "Sơ đồ phòng" && st.dirty > 0 && <span className="mono text-[10px] bg-[#3b1214] text-[#fca5a5] px-1.5 rounded-[2px]">{st.dirty}</span>}
              </button>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-[#252523] space-y-0.5">
            <button onClick={reset} className="flex w-full items-center gap-2.5 py-2 text-[12px] text-[#5c5c58] hover:text-white font-semibold"><RotateCcw size={13} strokeWidth={1.5} /> Khôi phục dữ liệu demo</button>
            <button onClick={logout} className="flex w-full items-center gap-2.5 py-2 text-[12px] text-[#5c5c58] hover:text-[#ef4444] font-semibold"><LogOut size={13} strokeWidth={1.5} /> Đăng xuất</button>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sticky top-0 z-20" style={{ height: 56 }}>
            <div className="flex items-center gap-2 text-[13px]"><span className="text-[#9ca3af] font-semibold">{branch?.name}</span><ChevronRight size={11} className="text-[#d1d5db]" /><span className="font-bold">{tab}</span></div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3 text-[12px] text-[#6b7280] font-semibold">
                <button onClick={() => goTo("Tìm kiếm", { search: { preset: "arrivals" } })} className="flex items-center gap-1.5 hover:text-[#1a1a1a]"><ArrowDownCircle size={13} className="text-[#2d6a4f]" /><span className="mono font-bold">{st.arrivalsPending.length}/{st.arrivalsToday.length}</span> Khách đến</button>
                <span className="text-[#e5e7eb]">|</span>
                <button onClick={() => goTo("Tìm kiếm", { search: { preset: "departures" } })} className="flex items-center gap-1.5 hover:text-[#1a1a1a]"><ArrowUpCircle size={13} className="text-[#c1121f]" /><span className="mono font-bold">{st.departuresPending.length}/{st.departuresToday.length}</span> Khách đi</button>
              </div>
              <div className="flex items-center gap-2"><div className="text-right"><div className="text-[12px] font-bold leading-tight">{session.staffName}</div><div className="text-[10px] text-[#9ca3af] font-semibold">Lễ tân · Front Desk</div></div><div className="w-8 h-8 rounded-full bg-[#0f0f0e] text-white text-[11px] font-bold flex items-center justify-center">{initials}</div></div>
            </div>
          </header>
          <main key={navKey} className="flex-1">
            {tab === "Tổng quan" && <OverviewTab />}
            {tab === "Tìm kiếm" && <SearchTab />}
            {tab === "Sơ đồ phòng" && <RoomMapTab />}
            {tab === "Room Plan" && <RoomPlanTab />}
            {tab === "Đặt phòng" && <ReservationTab />}
            {tab === "Thu ngân" && <CashierTab />}
            {tab === "Room Availability" && <AvailabilityTab />}
            {tab === "Báo cáo" && <ShiftReportTab />}
          </main>
        </div>
      </div>
      {top && top.kind === "checkin" && <CheckInOverlay key={top.reservationId + "ci"} reservationId={top.reservationId} onClose={closeTop} />}
      {top && top.kind === "checkout" && <CheckOutOverlay key={top.reservationId + "co"} reservationId={top.reservationId} onClose={closeTop} />}
      {top && top.kind === "folio" && <FolioOverlay key={top.reservationId + "fo"} reservationId={top.reservationId} onClose={closeTop} />}
      {toastMsg && <div className="fixed bottom-6 right-6 z-[60] bg-[#0f0f0e] text-white text-[13px] font-bold px-4 py-2.5 rounded-[3px] shadow-xl" style={{ animation: "pms-toast .2s ease" }}>{toastMsg}</div>}
    </NavContext.Provider>
  );
}

const noopSubscribe = () => () => {};
const readSession = () => { try { const n = localStorage.getItem("staffName"); return n ? `${n}|${localStorage.getItem("branchId") ?? "br-avanti"}` : ""; } catch { return ""; } };

export default function DashboardPage() {
  const router = useRouter();
  // null khi render phía server; "" khi chưa đăng nhập
  const raw = useSyncExternalStore(noopSubscribe, readSession, () => null);
  const session = useMemo<Session | null>(() => { if (!raw) return null; const [staffName, branchId] = raw.split("|"); return { staffName, branchId }; }, [raw]);
  useEffect(() => { if (raw === "") router.replace("/"); }, [raw, router]);
  if (!session) return <div className="min-h-screen flex items-center justify-center bg-[#f2f2ef] text-[13px] text-[#9ca3af] mono">Đang tải...</div>;
  return <PmsProvider session={session}><Shell /></PmsProvider>;
}
