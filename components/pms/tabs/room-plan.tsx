"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { addDays, diffDays, fmtDate, fmtDayMonth, isWeekend, RESERVATION_STATUS_LABEL, weekdayShort } from "@/lib/pms/format";
import { branchRooms, branchRoomTypes, guestById, roomTypeById } from "@/lib/pms/selectors";
import type { Reservation, ReservationStatus } from "@/lib/pms/types";
import { useNav } from "../nav";
import { ErrorBox, RES_STATUS_STYLE } from "../ui";

const COL_W = 48, ROW_H = 32, LABEL_W = 132, NUM_DAYS = 30;
const SHOWN: ReservationStatus[] = ["tentative", "confirmed", "checked_in", "checked_out"];
const DRAGGABLE: ReservationStatus[] = ["tentative", "confirmed"];

export function RoomPlanTab() {
  const { state, session, today, actions } = usePms();
  const { openOverlay, toast } = useNav();
  const [start, setStart] = useState(addDays(today, -2));
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [name, setName] = useState("");
  const [drag, setDrag] = useState<{ id: string; offset: number } | null>(null);
  const [over, setOver] = useState<{ roomId: string; day: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => Array.from({ length: NUM_DAYS }, (_, i) => addDays(start, i)), [start]);
  const types = branchRoomTypes(state, session.branchId);
  const allRooms = branchRooms(state, session.branchId);
  const floors = [...new Set(allRooms.map(r => r.floor))];
  const reservations = state.reservations.filter(r => r.branchId === session.branchId && r.roomId && SHOWN.includes(r.status));
  const byRoom = useMemo(() => { const m = new Map<string, Reservation[]>(); reservations.forEach(r => { m.set(r.roomId!, [...(m.get(r.roomId!) ?? []), r]); }); return m; }, [reservations]);
  const q = name.trim().toLowerCase();
  const rooms = allRooms.filter(r => (typeFilter === "ALL" || r.roomTypeId === typeFilter) && (floorFilter === "ALL" || r.floor === Number(floorFilter))
    && (!q || (byRoom.get(r.id) ?? []).some(res => guestById(state, res.guestId)?.fullName.toLowerCase().includes(q))));

  const onDrop = async (roomId: string, day: number) => {
    if (!drag) return;
    const newArrival = addDays(start, day - drag.offset);
    const r = await actions.moveReservation(drag.id, roomId, newArrival);
    if (!r.ok) setError(r.error); else { setError(null); toast("Đã dời đặt phòng"); }
    setDrag(null); setOver(null);
  };
  // Ngày tương ứng vị trí con trỏ trong hàng (thả lên ô trống hay lên thanh khác đều tính được)
  const dayAt = (e: React.DragEvent<HTMLDivElement>) => Math.max(0, Math.min(NUM_DAYS - 1, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / COL_W)));
  const sel = reservations.find(r => r.id === selected);

  return (
    <div className="flex flex-col bg-paper" style={{ height: "calc(100vh - 56px)" }}>
      <div className="bg-surface border-b border-line px-5 py-2.5 flex items-center gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Từ ngày</span><input type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)} aria-label="Từ ngày" className="mono text-[13px] font-medium border border-line rounded-ctl px-2 py-1 bg-sunken" /></div>
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Loại</span><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Loại phòng" className="border border-line rounded-ctl px-2 py-1 text-[13px] font-medium bg-sunken"><option value="ALL">Tất cả</option>{types.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}</select></div>
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Tầng</span><select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} aria-label="Tầng" className="border border-line rounded-ctl px-2 py-1 text-[13px] font-medium bg-sunken"><option value="ALL">Tất cả</option>{floors.map(f => <option key={f} value={f}>Tầng {f}</option>)}</select></div>
        <div className="flex items-center gap-1 border border-line rounded-ctl px-2 py-1 bg-sunken"><Search size={13} className="text-faint" aria-hidden="true" /><input aria-label="Tìm tên khách" value={name} onChange={e => setName(e.target.value)} className="outline-none bg-transparent text-[13px] font-medium w-32" placeholder="Tìm tên khách…" /></div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">{SHOWN.map(s => <div key={s} className="flex items-center gap-1 text-[12px] text-ink-2 font-medium"><span aria-hidden="true" className="w-3 h-3 rounded inline-block" style={{ background: RES_STATUS_STYLE[s].bg, border: `1px solid ${RES_STATUS_STYLE[s].border}` }} />{RESERVATION_STATUS_LABEL[s]}</div>)}</div>
        <div className="flex items-center border border-line rounded-ctl overflow-hidden bg-surface">
          <button onClick={() => setStart(d => addDays(d, -7))} aria-label="Lùi 7 ngày" className="px-2 py-1.5 hover:bg-line-soft border-r border-line"><ChevronLeft size={14} aria-hidden="true" /></button>
          <button onClick={() => setStart(addDays(today, -2))} className="px-3 py-1.5 text-[12px] font-semibold hover:bg-line-soft border-r border-line">Hôm nay</button>
          <button onClick={() => setStart(d => addDays(d, 7))} aria-label="Tới 7 ngày" className="px-2 py-1.5 hover:bg-line-soft"><ChevronRight size={14} aria-hidden="true" /></button>
        </div>
      </div>
      {error && <div className="px-5 pt-3"><ErrorBox message={error} /></div>}

      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: LABEL_W + COL_W * NUM_DAYS }}>
          <div className="flex sticky top-0 z-30 bg-surface border-b-2 border-line" style={{ height: 44 }}>
            <div className="shrink-0 flex items-end px-3 pb-2 border-r border-line sticky left-0 bg-sunken z-40" style={{ width: LABEL_W }}><span className="mono text-[11px] text-ink-2 font-semibold tracking-widest uppercase">Phòng</span></div>
            {dates.map(d => <div key={d} style={{ width: COL_W, minWidth: COL_W }} className={`shrink-0 flex flex-col items-center justify-end pb-1 border-r border-line-soft ${d === today ? "bg-dirty-soft" : isWeekend(d) ? "bg-weekend" : ""}`}>
              <div className={`mono text-[11px] font-semibold ${d === today ? "text-dirty" : isWeekend(d) ? "text-occ-ink" : "text-ink-2"}`}>{fmtDayMonth(d)}</div>
              <div className="text-[9px] uppercase font-semibold text-muted">{weekdayShort(d)}</div>
            </div>)}
          </div>
          {rooms.map((room, ri) => {
            const even = ri % 2 === 0;
            return (
              <div key={room.id} className="flex relative" style={{ height: ROW_H }}>
                <div className={`shrink-0 flex items-center gap-2 px-3 border-r border-b border-line sticky left-0 z-20 ${even ? "bg-surface" : "bg-sunken"}`} style={{ width: LABEL_W }}>
                  <span className="mono text-[12px] font-semibold text-ink-2">{room.number}</span><span className="text-[10px] text-muted uppercase font-semibold">{roomTypeById(state, room.roomTypeId)?.code}</span>
                  {room.hkStatus === "out_of_order" && <span className="text-[9px] font-semibold text-ink-2 bg-line px-1 rounded">OOO</span>}
                </div>
                <div className="relative flex flex-1 border-b border-line-soft"
                  onDragOver={e => { e.preventDefault(); const day = dayAt(e); if (over?.roomId !== room.id || over.day !== day) setOver({ roomId: room.id, day }); }}
                  onDrop={e => { e.preventDefault(); onDrop(room.id, dayAt(e)); }}>
                  {dates.map((d, di) => <div key={d} style={{ width: COL_W, minWidth: COL_W }}
                    className={`shrink-0 h-full border-r border-line-soft ${over?.roomId === room.id && over.day === di ? "!bg-blue-100" : d === today ? "bg-dirty-soft" : isWeekend(d) ? "bg-weekend" : even ? "bg-surface" : "bg-sunken"} ${room.hkStatus === "out_of_order" ? "bg-[repeating-linear-gradient(45deg,var(--color-line-soft),#f3f4f6_4px,#e5e7eb_4px,#e5e7eb_8px)]" : ""}`} />)}
                  {(byRoom.get(room.id) ?? []).map(res => {
                    const s = diffDays(start, res.arrivalDate), e = diffDays(start, res.departureDate);
                    if (e <= 0 || s >= NUM_DAYS) return null;
                    const cs = Math.max(0, s), ce = Math.min(NUM_DAYS, e);
                    const c = RES_STATUS_STYLE[res.status]; const isSel = selected === res.id; const canDrag = DRAGGABLE.includes(res.status);
                    return (
                      <div key={res.id} draggable={canDrag}
                        onDragStart={ev => { setDrag({ id: res.id, offset: Math.max(0, Math.floor((ev.clientX - ev.currentTarget.getBoundingClientRect().left) / COL_W)) + (cs - s) }); setSelected(res.id); ev.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        onClick={ev => { ev.stopPropagation(); setSelected(isSel ? null : res.id); }}
                        title={`${guestById(state, res.guestId)?.fullName} · #${res.confirmationNo} · ${fmtDate(res.arrivalDate)} → ${fmtDate(res.departureDate)}${canDrag ? " · kéo để dời" : ""}`}
                        className={`absolute top-[3px] rounded-ctl flex items-center px-2 overflow-hidden select-none ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${drag?.id === res.id ? "opacity-40" : ""}`}
                        style={{ left: cs * COL_W + 1, width: (ce - cs) * COL_W - 2, height: ROW_H - 6, background: c.bg, border: `1.5px solid ${isSel ? "var(--color-ink)" : c.border}`, boxShadow: isSel ? "0 0 0 2px var(--color-ink)" : "0 1px 4px rgba(0,0,0,0.2)", zIndex: isSel ? 25 : 15 }}>
                        <span className="mono text-[10px] font-semibold truncate" style={{ color: c.text }}>{guestById(state, res.guestId)?.fullName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && <div className="flex items-center justify-center py-16 text-[14px] text-muted font-medium">Không tìm thấy phòng phù hợp</div>}
        </div>
      </div>

      <div className="bg-surface border-t border-line px-5 py-2.5 flex items-center gap-3 shrink-0 text-[13px]">
        {!sel && <span className="text-[12px] text-muted font-medium">Kéo thả thanh Confirmed/Tentative để đổi phòng hoặc dời ngày. Bấm một thanh để xem thao tác.</span>}
        {sel && <>
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded" style={{ background: RES_STATUS_STYLE[sel.status].bg, border: `1px solid ${RES_STATUS_STYLE[sel.status].border}` }} />
          <span className="font-semibold">{guestById(state, sel.guestId)?.fullName}</span>
          <span className="mono text-ink-2 font-medium">#{sel.confirmationNo} · {fmtDate(sel.arrivalDate)} → {fmtDate(sel.departureDate)} · {RESERVATION_STATUS_LABEL[sel.status]}</span>
          <div className="flex-1" />
          <button onClick={() => openOverlay({ kind: "folio", reservationId: sel.id })} className="pms-btn-secondary text-[12px] py-1.5">Folio</button>
          {(sel.status === "confirmed" || sel.status === "tentative") && <button onClick={() => openOverlay({ kind: "checkin", reservationId: sel.id })} className="pms-btn-secondary text-[12px] py-1.5">{sel.arrivalDate === today ? "Check-in" : "Chi tiết / đổi phòng"}</button>}
          {sel.status === "checked_in" && <button onClick={() => openOverlay({ kind: "checkout", reservationId: sel.id })} className="pms-btn-danger text-[12px] py-1.5">Check-out</button>}
          <button onClick={() => setSelected(null)} aria-label="Bỏ chọn đặt phòng" className="w-7 h-7 flex items-center justify-center rounded-ctl text-muted hover:text-ink hover:bg-line-soft transition-colors">✕</button>
        </>}
      </div>
    </div>
  );
}
