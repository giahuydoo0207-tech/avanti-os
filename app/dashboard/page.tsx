"use client";
// Màn hình chính của Lễ tân. Toàn bộ tab đọc/ghi qua một kho dữ liệu chung (lib/pms/store.tsx)
// nên mọi thao tác (đặt phòng → check-in → folio → check-out → dọn phòng → giao ca) liên thông với nhau.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowDownCircle, ArrowUpCircle, BedDouble, CheckCircle2, CalendarDays, ChevronRight, ClipboardList, DollarSign, Home, LayoutGrid, LogOut, RotateCcw, Search, Table2 } from "lucide-react";
import { PmsProvider, usePms } from "@/lib/pms/store";
import { dashboardStats } from "@/lib/pms/selectors";
import type { Session } from "@/lib/pms/types";
import { fetchStaffProfile, getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
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
  const { state, session, today, actions, mode, pending } = usePms();
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

  const logout = async () => {
    if (mode === "supabase") await getSupabase().auth.signOut();
    try { localStorage.removeItem("staffName"); localStorage.removeItem("staffRole"); localStorage.removeItem("branchId"); } catch { /* */ }
    window.location.href = "/";
  };
  const reset = () => { if (window.confirm("Khôi phục toàn bộ dữ liệu demo về ban đầu? Mọi thao tác đã làm sẽ mất.")) { actions.resetDemo(); goTo("Tổng quan"); toast("Đã khôi phục dữ liệu demo"); } };

  const badge = (name: TabName) => {
    if (name === "Tìm kiếm" && st.arrivalsPending.length + st.departuresPending.length > 0)
      return <span className="mono text-[10px] leading-none bg-night-3 text-accent-bright px-1.5 py-1 rounded" aria-label={`${st.arrivalsPending.length + st.departuresPending.length} khách chờ xử lý`}>{st.arrivalsPending.length + st.departuresPending.length}</span>;
    if (name === "Sơ đồ phòng" && st.dirty > 0)
      return <span className="mono text-[10px] leading-none bg-dirty/25 text-dirty-line px-1.5 py-1 rounded" aria-label={`${st.dirty} phòng chờ dọn`}>{st.dirty}</span>;
    return null;
  };

  return (
    <NavContext.Provider value={nav}>
      <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[70] focus-visible:px-3 focus-visible:py-2 focus-visible:rounded-ctl focus-visible:bg-accent focus-visible:text-white focus-visible:text-[13px] focus-visible:font-semibold">Bỏ qua tới nội dung</a>
      <div className="flex min-h-screen bg-paper text-ink">
        <aside className="w-56 shrink-0 flex flex-col bg-night text-white sticky top-0 h-screen">
          <div className="px-5 pt-5 pb-4 border-b border-night-line">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold tracking-tight leading-tight truncate">{branch?.name}</div>
                <div className="text-[11px] text-night-muted leading-tight mt-0.5">{st.total} phòng · <span className="text-accent-bright" aria-label={`${branch?.stars ?? 0} sao`}>{"★".repeat(branch?.stars ?? 0)}</span></div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-night-muted">
              <span suppressHydrationWarning>{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              {mode === "demo" && <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-bright/80 border border-night-line rounded px-1.5 py-0.5">Demo</span>}
            </div>
          </div>
          <nav aria-label="Điều hướng chính" className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
            {MENU.map(({ name, icon: Icon }) => {
              const active = tab === name;
              return (
                <button key={name} onClick={() => goTo(name)} aria-current={active ? "page" : undefined}
                  className={`relative flex w-full items-center gap-3 px-3 py-2 rounded-ctl text-left text-[13px] transition-colors ${active ? "text-white" : "text-night-text hover:text-white hover:bg-night-2"}`}>
                  {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-ctl bg-night-3" transition={{ type: "spring", duration: 0.3, bounce: 0.15 }} />}
                  {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-bright" transition={{ type: "spring", duration: 0.3, bounce: 0.15 }} />}
                  <Icon size={16} strokeWidth={active ? 2 : 1.6} className="relative" aria-hidden="true" />
                  <span className={`relative flex-1 ${active ? "font-semibold" : "font-medium"}`}>{name}</span>
                  <span className="relative">{badge(name)}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-2.5 py-3 border-t border-night-line space-y-0.5">
            {mode === "demo" && <button onClick={reset} className="flex w-full items-center gap-2.5 px-3 py-2 rounded-ctl text-[12px] text-night-muted hover:text-white hover:bg-night-2 font-medium transition-colors"><RotateCcw size={14} strokeWidth={1.6} aria-hidden="true" /> Khôi phục dữ liệu demo</button>}
            <button onClick={logout} className="flex w-full items-center gap-2.5 px-3 py-2 rounded-ctl text-[12px] text-night-muted hover:text-dirty-line hover:bg-night-2 font-medium transition-colors"><LogOut size={14} strokeWidth={1.6} aria-hidden="true" /> Đăng xuất</button>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="bg-surface border-b border-line flex items-center justify-between px-7 shrink-0 sticky top-0 z-20" style={{ height: 56 }}>
            <div className="flex items-center gap-2 text-[13px] min-w-0"><span className="text-muted font-medium truncate">{branch?.name}</span><ChevronRight size={12} className="text-faint shrink-0" aria-hidden="true" /><h1 className="font-semibold text-ink truncate">{tab}</h1></div>
            <div className="flex items-center gap-4">
              <AnimatePresence>
                {pending > 0 && <motion.span key="saving" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-occ-ink bg-occ-soft border border-occ-line px-2 py-1 rounded"><span className="w-1.5 h-1.5 rounded-full bg-occ animate-pulse" aria-hidden="true" />Đang lưu…</motion.span>}
              </AnimatePresence>
              <div className="flex items-center gap-1 text-[12px] text-ink-2 font-medium">
                <button onClick={() => goTo("Tìm kiếm", { search: { preset: "arrivals" } })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-ctl hover:bg-line-soft hover:text-ink transition-colors"><ArrowDownCircle size={14} className="text-clean" aria-hidden="true" /><span className="mono font-semibold text-ink">{st.arrivalsPending.length}/{st.arrivalsToday.length}</span> Khách đến</button>
                <button onClick={() => goTo("Tìm kiếm", { search: { preset: "departures" } })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-ctl hover:bg-line-soft hover:text-ink transition-colors"><ArrowUpCircle size={14} className="text-dirty" aria-hidden="true" /><span className="mono font-semibold text-ink">{st.departuresPending.length}/{st.departuresToday.length}</span> Khách đi</button>
              </div>
              <div className="flex items-center gap-2.5 pl-4 border-l border-line"><div className="text-right"><div className="text-[12px] font-semibold leading-tight">{session.staffName}</div><div className="text-[11px] text-muted">Lễ tân</div></div><div aria-hidden="true" className="w-8 h-8 rounded-full bg-accent-soft text-accent-strong ring-1 ring-accent/20 text-[11px] font-bold flex items-center justify-center">{initials}</div></div>
            </div>
          </header>
          <motion.main id="main" key={navKey} className="flex-1 outline-none" tabIndex={-1}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {tab === "Tổng quan" && <OverviewTab />}
            {tab === "Tìm kiếm" && <SearchTab />}
            {tab === "Sơ đồ phòng" && <RoomMapTab />}
            {tab === "Room Plan" && <RoomPlanTab />}
            {tab === "Đặt phòng" && <ReservationTab />}
            {tab === "Thu ngân" && <CashierTab />}
            {tab === "Room Availability" && <AvailabilityTab />}
            {tab === "Báo cáo" && <ShiftReportTab />}
          </motion.main>
        </div>
      </div>
      <AnimatePresence>
        {top && top.kind === "checkin" && <CheckInOverlay key={top.reservationId + "ci"} reservationId={top.reservationId} onClose={closeTop} />}
        {top && top.kind === "checkout" && <CheckOutOverlay key={top.reservationId + "co"} reservationId={top.reservationId} onClose={closeTop} />}
        {top && top.kind === "folio" && <FolioOverlay key={top.reservationId + "fo"} reservationId={top.reservationId} onClose={closeTop} />}
      </AnimatePresence>
      <div aria-live="polite" className="fixed bottom-6 right-6 z-[60]">
        <AnimatePresence>
          {toastMsg && <motion.div key={toastMsg} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
            className="flex items-center gap-2 bg-night text-white text-[13px] font-medium pl-3 pr-4 py-2.5 rounded-ctl"><CheckCircle2 size={15} className="text-accent-bright" aria-hidden="true" />{toastMsg}</motion.div>}
        </AnimatePresence>
      </div>
      </MotionConfig>
    </NavContext.Provider>
  );
}

const noopSubscribe = () => () => {};
const readSession = () => { try { const n = localStorage.getItem("staffName"); return n ? `${n}|${localStorage.getItem("branchId") ?? "br-avanti"}` : ""; } catch { return ""; } };

/** Chế độ demo: phiên đăng nhập lưu trong localStorage */
function DemoGate() {
  const router = useRouter();
  // null khi render phía server; "" khi chưa đăng nhập
  const raw = useSyncExternalStore(noopSubscribe, readSession, () => null);
  const session = useMemo<Session | null>(() => { if (!raw) return null; const [staffName, branchId] = raw.split("|"); return { staffName, branchId }; }, [raw]);
  useEffect(() => { if (raw === "") router.replace("/"); }, [raw, router]);
  if (!session) return <Loading />;
  return <PmsProvider session={session}><Shell /></PmsProvider>;
}

/** Chế độ Supabase: phiên đăng nhập thật, chi nhánh lấy từ hồ sơ lễ tân của tài khoản */
function SupabaseGate() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let alive = true;
    fetchStaffProfile().then(p => {
      if (!alive) return;
      if (!p) router.replace("/");
      else setSession({ staffName: p.fullName, branchId: p.branchId, userId: p.userId });
    });
    return () => { alive = false; };
  }, [router]);
  if (!session) return <Loading />;
  return <PmsProvider session={session}><Shell /></PmsProvider>;
}

function Loading() {
  return <div className="min-h-screen flex items-center justify-center bg-paper text-[13px] text-muted" role="status"><span className="w-4 h-4 mr-2.5 rounded-full border-2 border-line-strong border-t-accent animate-spin" aria-hidden="true" />Đang tải…</div>;
}

export default function DashboardPage() {
  return isSupabaseConfigured ? <SupabaseGate /> : <DemoGate />;
}
