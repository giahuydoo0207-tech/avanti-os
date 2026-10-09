"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { BedDouble, Search, User } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { fmtDate, timeAgo } from "@/lib/pms/format";
import { branchRooms, dashboardStats, displayStatus, guestById, inHouseByRoom, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { Reservation } from "@/lib/pms/types";
import { useNav } from "../nav";
import { Card, ROOM_STATUS, SectionTitle, STATUS_ORDER } from "../ui";

export function OverviewTab() {
  const { state, session, today } = usePms();
  const { goTo, openOverlay } = useNav();
  const [q, setQ] = useState("");
  const st = dashboardStats(state, session.branchId, today);
  const rooms = branchRooms(state, session.branchId);
  const inHouse = inHouseByRoom(state, session.branchId);
  const floors = [...new Set(rooms.map(r => r.floor))].slice(0, 3);
  const activities = state.activities.filter(a => a.branchId === session.branchId).slice(0, 6);
  const pct = (n: number) => `${st.total ? Math.round((n / st.total) * 100) : 0}%`;

  const cards = [
    { label: "Công suất phòng", value: `${st.occupancyPct}%`, sub: `${st.total} phòng · ${st.ooo} phòng hỏng`, accent: "var(--color-ink)", bar: "var(--color-accent)", w: `${st.occupancyPct}%` },
    { label: "Đang có khách", value: st.occupied, sub: `${pct(st.occupied)} tổng số phòng`, accent: "var(--color-occ-ink)", bar: "var(--color-occ)", w: pct(st.occupied) },
    { label: "Trống sạch", value: st.clean, sub: "Sẵn sàng bán", accent: "var(--color-clean-ink)", bar: "var(--color-clean)", w: pct(st.clean) },
    { label: "Chờ dọn phòng", value: st.dirty, sub: st.dirty ? "Cần buồng phòng xử lý" : "Không có phòng bẩn", accent: "var(--color-dirty-ink)", bar: "var(--color-dirty)", w: pct(st.dirty) },
    { label: "Khách đến hôm nay", value: st.arrivalsToday.length, sub: `${st.arrivalsPending.length} chưa nhận phòng`, accent: "var(--color-arrive-ink)", bar: "var(--color-arrive)", w: `${st.arrivalsToday.length ? Math.round(((st.arrivalsToday.length - st.arrivalsPending.length) / st.arrivalsToday.length) * 100) : 0}%` },
  ];

  const row = (r: Reservation, action: React.ReactNode) => {
    const g = guestById(state, r.guestId); const room = roomById(state, r.roomId); const rt = roomTypeById(state, r.roomTypeId);
    return <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-line-soft last:border-0 gap-3">
      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{g?.fullName}</div><div className="text-[12px] text-muted mt-0.5">{room ? <span className="mono text-ink-2">P.{room.number}</span> : <span className="text-occ-ink">Chưa gán</span>} · {rt?.code} · {fmtDate(r.arrivalDate)}</div></div>
      {action}
    </div>;
  };
  const viewAll = (onClick: () => void) => <button onClick={onClick} className="text-[12px] text-muted hover:text-accent font-medium mb-4 transition-colors">Tất cả →</button>;

  return (
    <div className="p-7 max-w-6xl mx-auto space-y-5">
      <div className="flex gap-2 items-center">
        <form role="search" className="flex-1 flex items-center gap-2.5 bg-surface border border-line rounded-ctl px-3.5 hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 transition-[border-color,box-shadow]" onSubmit={e => { e.preventDefault(); goTo("Tìm kiếm", { search: { query: q } }); }}>
          <Search size={15} strokeWidth={1.75} className="text-faint" aria-hidden="true" />
          <input aria-label="Tìm khách" name="q" autoComplete="off" value={q} onChange={e => setQ(e.target.value)} className="flex-1 py-2.5 text-[13px] font-medium outline-none bg-transparent placeholder:text-faint" placeholder="Tên khách, số phòng, số xác nhận, folio… (Enter)" />
        </form>
        <button onClick={() => goTo("Đặt phòng", { reservation: { walkIn: true } })} className="pms-btn-secondary py-2.5"><User size={14} strokeWidth={1.75} aria-hidden="true" /> Walk In</button>
        <button onClick={() => goTo("Đặt phòng")} className="pms-btn-accent py-2.5"><BedDouble size={14} strokeWidth={1.75} aria-hidden="true" /> Đặt phòng mới</button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}>
            <Card className="p-4 h-full">
              <div className="text-[12px] text-ink-2 mb-2.5 font-medium">{c.label}</div>
              <div data-stat={c.label} className="mono text-[28px] font-semibold leading-none tracking-tight mb-1.5" style={{ color: c.accent }}>{c.value}</div>
              <div className="text-[12px] text-muted mb-3">{c.sub}</div>
              <div className="h-1 bg-line-soft rounded-full overflow-hidden"><motion.div className="h-full rounded-full" style={{ backgroundColor: c.bar }} initial={{ width: 0 }} animate={{ width: c.w }} transition={{ delay: 0.15 + i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} /></div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4"><SectionTitle>Sơ đồ phòng · 3 tầng đầu</SectionTitle><button onClick={() => goTo("Sơ đồ phòng")} className="text-[12px] text-muted hover:text-ink font-semibold">Xem đầy đủ →</button></div>
          <div className="space-y-3">{floors.map(f => (
            <div key={f}><div className="text-[12px] text-muted mb-1.5">Tầng {f}</div>
              <div className="flex gap-1 flex-wrap">{rooms.filter(r => r.floor === f).map(r => { const s = displayStatus(r, inHouse); return (
                <button key={r.id} title={`${r.number} · ${ROOM_STATUS[s].labelVi}`} aria-label={`Phòng ${r.number}, ${ROOM_STATUS[s].labelVi}`} onClick={() => goTo("Sơ đồ phòng", { roomId: r.id })} className={`room-cell w-11 h-8 border rounded flex items-center justify-center ${ROOM_STATUS[s].cell}`}><span className="mono text-[11px] font-semibold">{r.number}</span></button>
              ); })}</div>
            </div>
          ))}</div>
          <div className="mt-4 pt-4 border-t border-line-soft flex gap-5">{STATUS_ORDER.map(s => <div key={s} className="flex items-center gap-1.5 text-[12px] text-ink-2 font-medium"><span className={`w-2.5 h-2.5 rounded border inline-block ${ROOM_STATUS[s].cell}`} />{ROOM_STATUS[s].labelVi}</div>)}</div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionTitle>Khách đến hôm nay</SectionTitle>{viewAll(() => goTo("Tìm kiếm", { search: { preset: "arrivals" } }))}</div>
            {st.arrivalsPending.length === 0 && <div className="text-[12px] text-muted font-medium">Đã nhận phòng hết</div>}
            {st.arrivalsPending.slice(0, 4).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Check-in</button>))}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionTitle>Khách đi hôm nay</SectionTitle>{viewAll(() => goTo("Tìm kiếm", { search: { preset: "departures" } }))}</div>
            {st.departuresPending.length === 0 && <div className="text-[12px] text-muted font-medium">Không còn khách chờ trả phòng</div>}
            {st.departuresPending.slice(0, 4).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkout", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Check-out</button>))}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <SectionTitle>Chưa gán phòng ({st.unassigned.length})</SectionTitle>
          {st.unassigned.length === 0 && <div className="text-[12px] text-muted font-medium">Tất cả đặt phòng đã có phòng</div>}
          {st.unassigned.slice(0, 5).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Gán phòng</button>))}
        </Card>
        <Card className="p-5 col-span-2">
          <SectionTitle>Hoạt động gần đây</SectionTitle>
          <div className="space-y-3">{activities.map(a => (
            <div key={a.id} className="flex gap-2.5 items-start">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: a.action.includes("check_out") || a.action.includes("cancel") || a.action.includes("void") ? "var(--color-dirty)" : "var(--color-clean)" }} />
              <div className="flex-1"><div className="text-[13px] text-ink font-medium">{a.message}</div><div className="text-[12px] text-muted mt-0.5">{a.actorName} · {timeAgo(a.createdAt)}</div></div>
            </div>
          ))}</div>
        </Card>
      </div>
    </div>
  );
}
