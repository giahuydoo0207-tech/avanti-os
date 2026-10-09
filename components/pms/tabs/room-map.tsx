"use client";
import { useState } from "react";
import { LayoutGrid, MapIcon, User as UserIcon, X } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { fmtDate, money } from "@/lib/pms/format";
import { branchRooms, dashboardStats, displayStatus, folioOfReservation, folioTotals, guestById, inHouseByRoom, roomTypeById } from "@/lib/pms/selectors";
import type { Reservation, Room, RoomDisplayStatus } from "@/lib/pms/types";
import { useNav } from "../nav";
import { ErrorBox, ROOM_STATUS, StatusDot, STATUS_ORDER } from "../ui";

function Tooltip({ res, code, balance, guestName }: { res: Reservation; code: string; balance: number; guestName: string }) {
  return (
    <div className="absolute z-50 top-full mt-2 left-0 pointer-events-none" style={{ minWidth: 250 }}>
      <div className="text-[12px] text-ink p-3 rounded-ctl bg-surface border border-line">
        <div className="font-semibold text-[13px] mb-1">{guestName}</div>
        <div className="text-ink-2 space-y-0.5">
          <div>#{res.confirmationNo} · {code} · {res.adults} NL{res.children ? ` + ${res.children} TE` : ""}</div>
          <div className="mono">{fmtDate(res.arrivalDate)} → {fmtDate(res.departureDate)}</div>
          <div>Số dư: <span className={`mono font-semibold ${balance > 0 ? "text-dirty" : "text-clean"}`}>{money(balance)} ₫</span></div>
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
  const hk = async (roomId: string, s: "clean" | "dirty" | "out_of_order") => { const r = await actions.setHousekeeping(roomId, s); if (!r.ok) setError(r.error); else { setError(null); toast("Đã cập nhật trạng thái phòng"); } };
  const count: Record<RoomDisplayStatus, number> = { clean: st.clean, occupied: st.occupied, dirty: st.dirty, out_of_order: st.ooo };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="bg-surface border-b border-line px-7 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{branch?.name}</h2>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" role="group" aria-label="Lọc theo trạng thái">
            <span className="text-[12px] text-muted mr-2">{rooms.length} phòng · {floors.length} tầng</span>
            <button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={`text-[12px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filter === "all" ? "bg-night border-night text-white" : "border-line text-ink-2 hover:border-line-strong"}`}>Tất cả</button>
            {STATUS_ORDER.map(s => <button key={s} onClick={() => setFilter(f => (f === s ? "all" : s))} aria-pressed={filter === s} className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border transition-colors ${filter === s ? "border-current" : "border-line hover:border-line-strong"}`} style={{ color: ROOM_STATUS[s].mapText, background: filter === s ? ROOM_STATUS[s].mapBg : undefined }}><StatusDot status={s} /> <span className="mono">{count[s]}</span> {ROOM_STATUS[s].labelVi}</button>)}
          </div>
        </div>
        <div className="flex p-0.5 bg-line-soft border border-line rounded-ctl" role="group" aria-label="Kiểu hiển thị">
          <button onClick={() => setMode("hotelmap")} aria-pressed={mode === "hotelmap"} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[13px] font-medium transition-colors ${mode === "hotelmap" ? "bg-surface text-ink" : "text-ink-2 hover:text-ink"}`}><MapIcon size={14} strokeWidth={1.75} aria-hidden="true" /> Hotel Map</button>
          <button onClick={() => setMode("block")} aria-pressed={mode === "block"} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[13px] font-medium transition-colors ${mode === "block" ? "bg-surface text-ink" : "text-ink-2 hover:text-ink"}`}><LayoutGrid size={14} strokeWidth={1.75} aria-hidden="true" /> Block View</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className={mode === "block" ? "bg-surface border border-line rounded-card p-6" : ""}>
          <div className="space-y-5">{floors.map(f => (
            <div key={f}>
              <div className="text-[12px] text-muted font-medium mb-2 flex items-center gap-2">Tầng {f}<span aria-hidden="true" className="flex-1 h-px bg-line" /></div>
              <div className="flex flex-wrap gap-1.5">{rooms.filter(r => r.floor === f).map(room => {
                const s = displayStatus(room, inHouse); const c = ROOM_STATUS[s]; const i = info(room); const code = roomTypeById(state, room.roomTypeId)?.code ?? "";
                const dim = filter !== "all" && filter !== s; const isSel = selected === room.id; const arriving = arrivalFor(room.id);
                return (
                  <div key={room.id} className="relative" onMouseEnter={() => setHover(room.id)} onMouseLeave={() => setHover(null)} style={{ opacity: dim ? 0.25 : 1, transition: "opacity .2s ease" }}>
                    {mode === "hotelmap" ? (
                      <button type="button" data-status={s} aria-pressed={isSel} aria-label={`Phòng ${room.number}, ${c.labelVi}${i.guest ? `, khách ${i.guest}` : ""}`} onClick={() => setSelected(p => (p === room.id ? null : room.id))} className={`block text-left cursor-pointer select-none outline-2 -outline-offset-1 transition-[outline-color] ${isSel ? "outline-accent z-20 relative" : "outline-transparent hover:outline-line-strong"}`}
                        style={{ width: 104, minHeight: 70, background: c.mapBg, border: `1px solid ${c.mapBorder}`, borderRadius: 8 }}>
                        <div className="flex items-center justify-between px-1.5 pt-1.5"><StatusDot status={s} />{arriving && <span className="text-[10px] font-semibold px-1.5 leading-4 rounded bg-arrive text-white">Đến</span>}{i.res && <span className="flex items-center gap-0.5 mono text-[11px] font-semibold" style={{ color: c.mapSubText }}>{i.res.adults + i.res.children}<UserIcon size={11} strokeWidth={2} aria-hidden="true" /></span>}</div>
                        <div className="px-1.5 pb-1.5"><div className="mono font-semibold text-[14px] leading-tight" style={{ color: c.mapText }}>{room.number}</div><div className="text-[10px] font-medium uppercase leading-tight opacity-80" style={{ color: c.mapSubText }}>{code}</div>{i.res && <div className="text-[10px] font-medium truncate" style={{ color: c.mapText, maxWidth: 88 }}>{i.guest}</div>}</div>
                      </button>
                    ) : (
                      <button type="button" data-status={s} aria-pressed={isSel} aria-label={`Phòng ${room.number}, ${c.labelVi}`} onClick={() => setSelected(p => (p === room.id ? null : room.id))} className={`room-cell cursor-pointer border rounded-ctl flex flex-col items-center justify-center ${c.cell} ${isSel ? "outline-ink z-20 relative" : ""}`} style={{ width: 56, height: 46 }}>
                        <span className="mono text-[11px] font-semibold leading-tight">{room.number}</span><span className="text-[9px] font-medium opacity-80 uppercase">{code}</span>
                      </button>
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
        <div className="bg-surface border-t border-line px-7 py-3 flex items-center gap-4 shrink-0 text-[13px] flex-wrap" role="region" aria-label={`Thao tác phòng ${sel.number}`}>
          <div className="flex items-center gap-2 font-semibold shrink-0"><StatusDot status={selStatus} /><span className="mono text-[15px]">Phòng {sel.number}</span><span className="text-muted font-medium">· {roomTypeById(state, sel.roomTypeId)?.name}</span><span className="px-2 py-0.5 rounded text-[11px] font-semibold border" style={{ background: ROOM_STATUS[selStatus].mapBg, color: ROOM_STATUS[selStatus].mapText, borderColor: ROOM_STATUS[selStatus].mapBorder }}>{ROOM_STATUS[selStatus].labelVi}</span></div>
          <div className="w-px h-4 bg-line" />
          {selInfo.res ? <>
            <span className="font-semibold">{selInfo.guest}</span>
            <span className="text-muted font-medium mono">{fmtDate(selInfo.res.arrivalDate)} → {fmtDate(selInfo.res.departureDate)}</span>
            <span className={`mono font-semibold ${selInfo.balance > 0 ? "text-dirty" : "text-clean"}`}>Số dư {money(selInfo.balance)} ₫</span>
            <div className="flex-1" />
            <button onClick={() => openOverlay({ kind: "folio", reservationId: selInfo.res!.id })} className="pms-btn-secondary text-[12px] py-1.5">Folio / Post charge</button>
            <button onClick={() => openOverlay({ kind: "checkout", reservationId: selInfo.res!.id })} className="pms-btn-danger text-[12px] py-1.5">Check-out</button>
          </> : <>
            {selArrival && <span className="font-medium">Khách đến hôm nay: <b>{guestById(state, selArrival.guestId)?.fullName}</b></span>}
            {!selArrival && <span className="text-muted font-medium">Không có khách</span>}
            <div className="flex-1" />
            {selStatus === "dirty" && <button onClick={() => hk(sel.id, "clean")} className="pms-btn-primary text-[12px] py-1.5">✓ Đánh dấu đã dọn</button>}
            {selStatus === "clean" && <button onClick={() => hk(sel.id, "dirty")} className="pms-btn-secondary text-[12px] py-1.5">Đánh dấu chờ dọn</button>}
            {selStatus !== "out_of_order" && <button onClick={() => hk(sel.id, "out_of_order")} className="pms-btn-secondary text-[12px] py-1.5">Báo hỏng (OOO)</button>}
            {selStatus === "out_of_order" && <button onClick={() => hk(sel.id, "dirty")} className="pms-btn-primary text-[12px] py-1.5">Sửa xong → chờ dọn</button>}
            {selArrival && <button onClick={() => openOverlay({ kind: "checkin", reservationId: selArrival.id })} className="pms-btn-primary text-[12px] py-1.5">Check-in</button>}
            {!selArrival && selStatus === "clean" && <button onClick={() => goTo("Đặt phòng", { reservation: { roomId: sel.id, walkIn: true } })} className="pms-btn-primary text-[12px] py-1.5">Walk-in vào phòng này</button>}
          </>}
          <button onClick={() => setSelected(null)} aria-label="Đóng thanh thao tác" className="w-7 h-7 flex items-center justify-center rounded-ctl text-muted hover:text-ink hover:bg-line-soft transition-colors ml-1"><X size={16} aria-hidden="true" /></button>
          {error && <div className="w-full"><ErrorBox message={error} /></div>}
        </div>
      )}
    </div>
  );
}
