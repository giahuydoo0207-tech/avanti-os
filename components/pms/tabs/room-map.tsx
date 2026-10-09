"use client";
import { useState } from "react";
import { LayoutGrid, MapIcon } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { fmtDate, money } from "@/lib/pms/format";
import { branchRooms, dashboardStats, displayStatus, folioOfReservation, folioTotals, guestById, inHouseByRoom, roomTypeById } from "@/lib/pms/selectors";
import type { Reservation, Room, RoomDisplayStatus } from "@/lib/pms/types";
import { useNav } from "../nav";
import { ErrorBox, ROOM_STATUS, StatusDot, STATUS_ORDER } from "../ui";

function Tooltip({ res, code, balance, guestName }: { res: Reservation; code: string; balance: number; guestName: string }) {
  return (
    <div className="absolute z-50 top-full mt-2 left-0 pointer-events-none" style={{ minWidth: 250 }}>
      <div className="text-[12px] text-[#1a1a1a] p-3 rounded-[2px] shadow-2xl" style={{ background: "#fffef0", border: "1px solid #d4c87a" }}>
        <div className="font-bold text-[13px] mb-1">{guestName}</div>
        <div className="text-[#6b7280] space-y-0.5">
          <div>#{res.confirmationNo} · {code} · {res.adults} NL{res.children ? ` + ${res.children} TE` : ""}</div>
          <div className="mono">{fmtDate(res.arrivalDate)} → {fmtDate(res.departureDate)}</div>
          <div>Số dư: <span className={`mono font-bold ${balance > 0 ? "text-[#c1121f]" : "text-[#15803d]"}`}>{money(balance)} ₫</span></div>
        </div>
      </div>
    </div>
  );
}

export function RoomMapTab() {
  const { state, session, today, actions } = usePms();
  const { intent, openOverlay, goTo, toast } = useNav();
  const [mode, setMode] = useState<"hotelmap" | "block">("hotelmap");
  const [filter, setFilter] = useState<RoomDisplayStatus | "all">("all");
  const [selected, setSelected] = useState<string | null>(intent.roomId ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rooms = branchRooms(state, session.branchId);
  const inHouse = inHouseByRoom(state, session.branchId);
  const st = dashboardStats(state, session.branchId, today);
  const floors = [...new Set(rooms.map(r => r.floor))];
  const branch = state.branches.find(b => b.id === session.branchId);
  const arrivalFor = (roomId: string) => st.arrivalsPending.find(r => r.roomId === roomId);
  const info = (room: Room) => {
    const res = inHouse.get(room.id);
    const folio = res ? folioOfReservation(state, res.id) : undefined;
    return { res, balance: folio ? folioTotals(state, folio.id).balance : 0, guest: res ? guestById(state, res.guestId)?.fullName ?? "" : "" };
  };
  const sel = rooms.find(r => r.id === selected);
  const selStatus = sel ? displayStatus(sel, inHouse) : null;
  const selInfo = sel ? info(sel) : null;
  const selArrival = sel ? arrivalFor(sel.id) : undefined;
  const hk = (roomId: string, s: "clean" | "dirty" | "out_of_order") => { const r = actions.setHousekeeping(roomId, s); if (!r.ok) setError(r.error); else { setError(null); toast("Đã cập nhật trạng thái phòng"); } };
  const count: Record<RoomDisplayStatus, number> = { clean: st.clean, occupied: st.occupied, dirty: st.dirty, out_of_order: st.ooo };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="bg-white border-b border-[#e5e7eb] px-7 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h1 className="text-[21px] font-bold tracking-[0.16em] uppercase" style={{ color: "#2d6a4f" }}>{branch?.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="mono text-[12px] text-[#9ca3af] font-semibold">{rooms.length} phòng · {floors.length} tầng</span>
            <span className="text-[#e5e7eb]">|</span>
            <button onClick={() => setFilter("all")} className={`text-[12px] font-bold px-2 py-0.5 rounded-[2px] ${filter === "all" ? "bg-[#0f0f0e] text-white" : "text-[#6b7280]"}`}>Tất cả</button>
            {STATUS_ORDER.map(s => <button key={s} onClick={() => setFilter(f => (f === s ? "all" : s))} className={`flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-[2px] ${filter === s ? "bg-[#f3f4f6] ring-1 ring-[#9ca3af]" : ""}`} style={{ color: ROOM_STATUS[s].mapSubText }}><StatusDot status={s} /> {count[s]} {ROOM_STATUS[s].labelVi}</button>)}
          </div>
        </div>
        <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={() => setMode("hotelmap")} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold border-r border-[#e5e7eb] ${mode === "hotelmap" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}><MapIcon size={13} strokeWidth={1.5} /> Hotel Map</button>
          <button onClick={() => setMode("block")} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold ${mode === "block" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}><LayoutGrid size={13} strokeWidth={1.5} /> Block View</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className={mode === "block" ? "bg-white border border-[#e5e7eb] rounded-[3px] shadow-sm p-6" : ""}>
          <div className="space-y-5">{floors.map(f => (
            <div key={f}>
              <div className="mono text-[10px] tracking-[0.14em] uppercase text-[#9ca3af] font-bold mb-2">Tầng {f}</div>
              <div className="flex flex-wrap gap-1">{rooms.filter(r => r.floor === f).map(room => {
                const s = displayStatus(room, inHouse); const c = ROOM_STATUS[s]; const i = info(room); const code = roomTypeById(state, room.roomTypeId)?.code ?? "";
                const dim = filter !== "all" && filter !== s; const isSel = selected === room.id; const arriving = arrivalFor(room.id);
                return (
                  <div key={room.id} className="relative" onMouseEnter={() => setHover(room.id)} onMouseLeave={() => setHover(null)} style={{ opacity: dim ? 0.25 : 1 }}>
                    {mode === "hotelmap" ? (
                      <div onClick={() => setSelected(p => (p === room.id ? null : room.id))} className={`cursor-pointer select-none transition-all ${isSel ? "ring-2 ring-[#0f0f0e] ring-offset-1 z-20 relative shadow-lg" : "hover:shadow-lg hover:-translate-y-0.5"}`}
                        style={{ width: 100, minHeight: 68, background: c.mapBg, border: `1.5px solid ${isSel ? "#374151" : c.mapBorder}`, borderRadius: 3 }}>
                        <div className="flex items-center justify-between px-1.5 pt-1.5"><StatusDot status={s} />{arriving && <span className="text-[9px] font-bold px-1 rounded-[2px] bg-[#dbeafe] text-[#1d4ed8]">ĐẾN</span>}{i.res && <span className="mono text-[11px] font-bold" style={{ color: c.mapSubText }}>{i.res.adults + i.res.children}👤</span>}</div>
                        <div className="px-1.5 pb-1.5"><div className="mono font-bold text-[14px] leading-tight" style={{ color: c.mapText }}>{room.number}</div><div className="text-[10px] font-bold tracking-wide uppercase leading-tight" style={{ color: c.mapSubText }}>{code}</div>{i.res && <div className="text-[10px] font-semibold truncate" style={{ color: c.mapText, maxWidth: 88 }}>{i.guest}</div>}</div>
                      </div>
                    ) : (
                      <div onClick={() => setSelected(p => (p === room.id ? null : room.id))} className={`cursor-pointer border rounded-[3px] flex flex-col items-center justify-center text-white ${c.cell} ${isSel ? "ring-2 ring-[#0f0f0e] ring-offset-1 scale-110 shadow-xl relative z-20" : "hover:scale-[1.1]"}`} style={{ width: 54, height: 44 }}>
                        <span className="mono text-[11px] font-bold leading-tight">{room.number}</span><span className="text-[8px] font-bold opacity-80 uppercase">{code}</span>
                      </div>
                    )}
                    {hover === room.id && i.res && <Tooltip res={i.res} code={code} balance={i.balance} guestName={i.guest} />}
                  </div>
                );
              })}</div>
            </div>
          ))}</div>
        </div>
      </div>

      {sel && selStatus && selInfo && (
        <div className="bg-white border-t border-[#e5e7eb] px-7 py-3 flex items-center gap-4 shrink-0 text-[13px] shadow-[0_-1px_4px_rgba(0,0,0,0.06)] flex-wrap">
          <div className="flex items-center gap-2 font-bold shrink-0"><StatusDot status={selStatus} /><span className="mono text-[15px]">Phòng {sel.number}</span><span className="text-[#9ca3af] font-semibold">· {roomTypeById(state, sel.roomTypeId)?.name}</span><span className="px-2 py-0.5 rounded-[2px] text-[11px] font-bold text-white" style={{ background: ROOM_STATUS[selStatus].dot }}>{ROOM_STATUS[selStatus].labelVi.toUpperCase()}</span></div>
          <div className="w-px h-4 bg-[#e5e7eb]" />
          {selInfo.res ? <>
            <span className="font-bold">{selInfo.guest}</span>
            <span className="text-[#9ca3af] font-semibold mono">{fmtDate(selInfo.res.arrivalDate)} → {fmtDate(selInfo.res.departureDate)}</span>
            <span className={`mono font-bold ${selInfo.balance > 0 ? "text-[#c1121f]" : "text-[#15803d]"}`}>Số dư {money(selInfo.balance)} ₫</span>
            <div className="flex-1" />
            <button onClick={() => openOverlay({ kind: "folio", reservationId: selInfo.res!.id })} className="pms-btn-secondary text-[12px] py-1.5">Folio / Post charge</button>
            <button onClick={() => openOverlay({ kind: "checkout", reservationId: selInfo.res!.id })} className="pms-btn-danger text-[12px] py-1.5">Check-out</button>
          </> : <>
            {selArrival && <span className="font-semibold">Khách đến hôm nay: <b>{guestById(state, selArrival.guestId)?.fullName}</b></span>}
            {!selArrival && <span className="text-[#9ca3af] font-semibold">Không có khách</span>}
            <div className="flex-1" />
            {selStatus === "dirty" && <button onClick={() => hk(sel.id, "clean")} className="pms-btn-primary text-[12px] py-1.5">✓ Đánh dấu đã dọn</button>}
            {selStatus === "clean" && <button onClick={() => hk(sel.id, "dirty")} className="pms-btn-secondary text-[12px] py-1.5">Đánh dấu chờ dọn</button>}
            {selStatus !== "out_of_order" && <button onClick={() => hk(sel.id, "out_of_order")} className="pms-btn-secondary text-[12px] py-1.5">Báo hỏng (OOO)</button>}
            {selStatus === "out_of_order" && <button onClick={() => hk(sel.id, "dirty")} className="pms-btn-primary text-[12px] py-1.5">Sửa xong → chờ dọn</button>}
            {selArrival && <button onClick={() => openOverlay({ kind: "checkin", reservationId: selArrival.id })} className="pms-btn-primary text-[12px] py-1.5">Check-in</button>}
            {!selArrival && selStatus === "clean" && <button onClick={() => goTo("Đặt phòng", { reservation: { roomId: sel.id, walkIn: true } })} className="pms-btn-primary text-[12px] py-1.5">Walk-in vào phòng này</button>}
          </>}
          <button onClick={() => setSelected(null)} className="text-[#9ca3af] hover:text-[#1a1a1a] text-[15px] ml-1 font-bold">✕</button>
          {error && <div className="w-full"><ErrorBox message={error} /></div>}
        </div>
      )}
    </div>
  );
}
