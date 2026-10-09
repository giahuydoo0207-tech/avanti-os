"use client";
import { useState } from "react";
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
    { label: "Tổng phòng", value: st.total, sub: `${st.ooo} phòng hỏng · công suất ${st.occupancyPct}%`, accent: "#374151" },
    { label: "Đang có khách", value: st.occupied, sub: "Occupied", accent: "#7a5800", bar: "#e9c46a", w: pct(st.occupied) },
    { label: "Trống sạch", value: st.clean, sub: "Sẵn sàng bán", accent: "#1b4332", bar: "#2d6a4f", w: pct(st.clean) },
    { label: "Chờ dọn phòng", value: st.dirty, sub: "Needs cleaning", accent: "#8b0000", bar: "#c1121f", w: pct(st.dirty) },
    { label: "Khách đến hôm nay", value: st.arrivalsToday.length, sub: `${st.arrivalsPending.length} chưa nhận phòng`, accent: "#374151" },
  ];

  const row = (r: Reservation, action: React.ReactNode) => {
    const g = guestById(state, r.guestId); const room = roomById(state, r.roomId); const rt = roomTypeById(state, r.roomTypeId);
    return <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#f3f4f6] last:border-0 gap-2">
      <div className="min-w-0"><div className="text-[13px] font-bold truncate">{g?.fullName}</div><div className="mono text-[11px] text-[#9ca3af] font-semibold">{room ? `P.${room.number}` : "Chưa gán"} · {rt?.code} · {fmtDate(r.arrivalDate)}</div></div>
      {action}
    </div>;
  };

  return (
    <div className="p-7 max-w-6xl mx-auto space-y-5">
      <div className="grid grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-5">
            <div className="text-[10px] tracking-[0.14em] uppercase text-[#9ca3af] mb-3 font-bold">{c.label}</div>
            <div className="mono text-[30px] font-bold leading-none mb-1" style={{ color: c.accent }}>{c.value}</div>
            <div className="text-[12px] text-[#9ca3af] mb-3 font-semibold">{c.sub}</div>
            {c.bar && <div className="h-1 bg-[#f3f4f6] rounded-full"><div className="h-full rounded-full" style={{ backgroundColor: c.bar, width: c.w }} /></div>}
          </Card>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={() => goTo("Đặt phòng", { reservation: { walkIn: true } })} className="pms-btn-secondary"><User size={13} strokeWidth={1.5} /> Walk In</button>
        <button onClick={() => goTo("Đặt phòng")} className="pms-btn-secondary"><BedDouble size={13} strokeWidth={1.5} /> Đặt phòng mới</button>
        <form className="flex-1 flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-[3px] px-3 hover:border-[#9ca3af] transition-all shadow-sm" onSubmit={e => { e.preventDefault(); goTo("Tìm kiếm", { search: { query: q } }); }}>
          <Search size={13} strokeWidth={1.5} className="text-[#9ca3af]" />
          <input value={q} onChange={e => setQ(e.target.value)} className="flex-1 py-2 text-[13px] font-semibold outline-none bg-transparent placeholder:text-[#d1d5db]" placeholder="Tên khách, số phòng, số xác nhận, folio... (Enter)" />
        </form>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4"><SectionTitle>Sơ đồ phòng — 3 tầng đầu</SectionTitle><button onClick={() => goTo("Sơ đồ phòng")} className="text-[12px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold">Xem đầy đủ →</button></div>
          <div className="space-y-3">{floors.map(f => (
            <div key={f}><div className="mono text-[10px] tracking-[0.1em] uppercase text-[#9ca3af] mb-1.5 font-bold">Tầng {f}</div>
              <div className="flex gap-1 flex-wrap">{rooms.filter(r => r.floor === f).map(r => { const s = displayStatus(r, inHouse); return (
                <button key={r.id} title={`${r.number} · ${ROOM_STATUS[s].labelVi}`} onClick={() => goTo("Sơ đồ phòng", { roomId: r.id })} className={`room-cell w-10 h-7 border rounded-[2px] flex items-center justify-center text-white ${ROOM_STATUS[s].cell}`}><span className="mono text-[10px] font-bold">{r.number}</span></button>
              ); })}</div>
            </div>
          ))}</div>
          <div className="mt-4 pt-4 border-t border-[#f3f4f6] flex gap-5">{STATUS_ORDER.map(s => <div key={s} className="flex items-center gap-1.5 text-[12px] text-[#6b7280] font-semibold"><span className={`w-2.5 h-2.5 rounded-[2px] border inline-block ${ROOM_STATUS[s].cell}`} />{ROOM_STATUS[s].labelVi}</div>)}</div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionTitle>Khách đến hôm nay</SectionTitle><button onClick={() => goTo("Tìm kiếm", { search: { preset: "arrivals" } })} className="text-[11px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold mb-4">Tất cả →</button></div>
            {st.arrivalsPending.length === 0 && <div className="text-[12px] text-[#9ca3af] font-semibold">Đã nhận phòng hết</div>}
            {st.arrivalsPending.slice(0, 4).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Check-in</button>))}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionTitle>Khách đi hôm nay</SectionTitle><button onClick={() => goTo("Tìm kiếm", { search: { preset: "departures" } })} className="text-[11px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold mb-4">Tất cả →</button></div>
            {st.departuresPending.length === 0 && <div className="text-[12px] text-[#9ca3af] font-semibold">Không còn khách chờ trả phòng</div>}
            {st.departuresPending.slice(0, 4).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkout", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Check-out</button>))}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <SectionTitle>Chưa gán phòng ({st.unassigned.length})</SectionTitle>
          {st.unassigned.length === 0 && <div className="text-[12px] text-[#9ca3af] font-semibold">Tất cả đặt phòng đã có phòng</div>}
          {st.unassigned.slice(0, 5).map(r => row(r, <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} className="pms-btn-secondary text-[11px] py-1.5 px-3 shrink-0">Gán phòng</button>))}
        </Card>
        <Card className="p-5 col-span-2">
          <SectionTitle>Hoạt động gần đây</SectionTitle>
          <div className="space-y-3">{activities.map(a => (
            <div key={a.id} className="flex gap-2.5 items-start">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: a.action.includes("check_out") || a.action.includes("cancel") || a.action.includes("void") ? "#c1121f" : "#2d6a4f" }} />
              <div className="flex-1"><div className="text-[13px] text-[#374151] font-semibold">{a.message}</div><div className="mono text-[11px] text-[#9ca3af] font-semibold">{a.actorName} · {timeAgo(a.createdAt)}</div></div>
            </div>
          ))}</div>
        </Card>
      </div>
    </div>
  );
}
