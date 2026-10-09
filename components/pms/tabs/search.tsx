"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { fmtDate, money } from "@/lib/pms/format";
import { branchReservations, folioOfReservation, folioTotals, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { Reservation, ReservationStatus } from "@/lib/pms/types";
import { countryLabel } from "../guest-form";
import { useNav } from "../nav";
import { Card, EmptyRow, FieldRow, inputCls, ResBadge, SectionTitle } from "../ui";

type DateMode = "none" | "arrival" | "departure" | "stay";
const STATUS_FILTERS: Array<[ReservationStatus, string]> = [["tentative", "Tentative"], ["confirmed", "Confirmed"], ["checked_in", "Đang ở"], ["checked_out", "Đã trả phòng"], ["cancelled", "Đã hủy"]];

export function SearchTab() {
  const { state, session, today } = usePms();
  const { intent, openOverlay, goTo } = useNav();
  type Preset = "arrivals" | "departures" | "inhouse";
  const presetStatuses = (p: Preset | null): Record<ReservationStatus, boolean> => {
    const base = { tentative: true, confirmed: true, checked_in: true, checked_out: false, cancelled: false, no_show: false };
    if (p === "departures") return { ...base, tentative: false, confirmed: false, checked_out: true };
    if (p === "inhouse") return { ...base, tentative: false, confirmed: false };
    return base;
  };
  const initPreset = intent.search?.preset ?? null;
  const [text, setText] = useState(intent.search?.query ?? "");
  const [roomText, setRoomText] = useState("");
  const [company, setCompany] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>(initPreset === "arrivals" ? "arrival" : initPreset === "departures" ? "departure" : "none");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [statuses, setStatuses] = useState<Record<ReservationStatus, boolean>>(() => presetStatuses(initPreset));
  const [sort, setSort] = useState<{ col: "arrival" | "room" | "name"; asc: boolean }>({ col: "arrival", asc: true });

  const applyPreset = (p: Preset) => {
    setText(""); setRoomText(""); setCompany(""); setFrom(today); setTo(today);
    setDateMode(p === "arrivals" ? "arrival" : p === "departures" ? "departure" : "none");
    setStatuses(presetStatuses(p));
  };

  const results = useMemo(() => {
    const q = text.trim().toLowerCase();
    const rq = roomText.trim().toLowerCase();
    const cq = company.trim().toLowerCase();
    const list = branchReservations(state, session.branchId).filter(r => {
      if (!statuses[r.status]) return false;
      const g = guestById(state, r.guestId);
      const room = roomById(state, r.roomId);
      const folio = folioOfReservation(state, r.id);
      if (q && !(g?.fullName.toLowerCase().includes(q) || r.confirmationNo.includes(q) || folio?.folioNo.includes(q) || g?.phone.includes(q) || g?.idNumber.toLowerCase().includes(q) || room?.number === q)) return false;
      if (rq && !(room?.number.includes(rq) || roomTypeById(state, r.roomTypeId)?.code.toLowerCase().includes(rq))) return false;
      if (cq && !g?.company.toLowerCase().includes(cq)) return false;
      if (dateMode === "arrival" && !(r.arrivalDate >= from && r.arrivalDate <= to)) return false;
      if (dateMode === "departure" && !(r.departureDate >= from && r.departureDate <= to)) return false;
      if (dateMode === "stay" && !(r.arrivalDate <= to && r.departureDate > from)) return false;
      return true;
    });
    const key = (r: Reservation) => sort.col === "arrival" ? r.arrivalDate : sort.col === "room" ? (roomById(state, r.roomId)?.number ?? "~") : (guestById(state, r.guestId)?.fullName ?? "");
    return list.sort((a, b) => (sort.asc ? 1 : -1) * key(a).localeCompare(key(b)));
  }, [state, session.branchId, text, roomText, company, dateMode, from, to, statuses, sort]);

  const open = (r: Reservation) => {
    if (r.status === "checked_in") openOverlay({ kind: "checkout", reservationId: r.id });
    else if (r.status === "confirmed" || r.status === "tentative") openOverlay({ kind: "checkin", reservationId: r.id });
    else openOverlay({ kind: "folio", reservationId: r.id });
  };
  const th = (label: string, col?: "arrival" | "room" | "name") => (
    <th key={label} onClick={col ? () => setSort(s => ({ col, asc: s.col === col ? !s.asc : true })) : undefined} className={`px-3 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold whitespace-nowrap ${col ? "cursor-pointer hover:text-[#1a1a1a]" : ""}`}>
      {label}{col && sort.col === col ? (sort.asc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="p-7 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-[16px] font-bold">Tìm kiếm</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Guest & Reservation Search</div></div>
        <div className="flex gap-2">
          <button onClick={() => applyPreset("arrivals")} className="pms-btn-secondary">Khách đến hôm nay</button>
          <button onClick={() => applyPreset("departures")} className="pms-btn-secondary">Khách đi hôm nay</button>
          <button onClick={() => applyPreset("inhouse")} className="pms-btn-secondary">Đang ở</button>
          <button onClick={() => goTo("Đặt phòng")} className="pms-btn-primary">+ Đặt phòng mới</button>
        </div>
      </div>

      <Card className="p-6">
        <SectionTitle>Bộ lọc</SectionTitle>
        <div className="grid grid-cols-3 gap-x-8 gap-y-3">
          <FieldRow label="Khách / mã"><input className={inputCls} value={text} onChange={e => setText(e.target.value)} placeholder="Tên, số xác nhận, folio, SĐT, giấy tờ" /></FieldRow>
          <FieldRow label="Phòng / loại"><input className={inputCls} value={roomText} onChange={e => setRoomText(e.target.value)} placeholder="305 hoặc DLXTC" /></FieldRow>
          <FieldRow label="Công ty"><input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} /></FieldRow>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#f3f4f6]">
          <select value={dateMode} onChange={e => setDateMode(e.target.value as DateMode)} className="border border-[#e5e7eb] rounded-[3px] px-2 py-1.5 text-[13px] font-bold bg-[#fafafa]">
            <option value="none">Không lọc ngày</option><option value="arrival">Theo ngày đến</option><option value="departure">Theo ngày đi</option><option value="stay">Lưu trú trong khoảng</option>
          </select>
          <span className="text-[13px] text-[#9ca3af] font-semibold">Từ</span>
          <input type="date" value={from} disabled={dateMode === "none"} onChange={e => setFrom(e.target.value)} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 bg-white disabled:opacity-40" />
          <span className="text-[13px] text-[#9ca3af] font-semibold">Đến</span>
          <input type="date" value={to} disabled={dateMode === "none"} onChange={e => setTo(e.target.value)} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 bg-white disabled:opacity-40" />
          <div className="w-px h-5 bg-[#e5e7eb]" />
          {STATUS_FILTERS.map(([s, l]) => <label key={s} className="flex items-center gap-1.5 text-[12px] text-[#6b7280] cursor-pointer font-semibold"><input type="checkbox" checked={statuses[s]} onChange={e => setStatuses(x => ({ ...x, [s]: e.target.checked }))} className="w-3.5 h-3.5 accent-[#0f0f0e]" /> {l}</label>)}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f3f4f6] flex items-center justify-between"><span className="text-[13px] font-bold"><Search size={12} className="inline mr-1.5" />{results.length} kết quả</span><span className="text-[12px] text-[#9ca3af] font-semibold">Bấm vào dòng: chờ đến → Check-in · đang ở → Check-out · khác → Folio</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 1100 }}>
            <thead><tr className="border-b-2 border-[#e5e7eb] bg-[#fafafa]">
              {th("Trạng thái")}{th("Xác nhận")}{th("Folio")}{th("Tên khách", "name")}{th("Quốc tịch")}{th("Phòng", "room")}{th("Loại")}
              {th("Đến", "arrival")}{th("Đi")}{th("Khách")}{th("Giá/đêm")}{th("Số dư")}{th("Nguồn")}
            </tr></thead>
            <tbody>
              {results.length === 0 && <EmptyRow cols={13} text="Không có đặt phòng phù hợp" />}
              {results.map((r, i) => {
                const g = guestById(state, r.guestId); const room = roomById(state, r.roomId); const folio = folioOfReservation(state, r.id);
                const bal = folio ? folioTotals(state, folio.id).balance : 0;
                return (
                  <tr key={r.id} onClick={() => open(r)} className={`border-b border-[#f3f4f6] cursor-pointer hover:bg-[#fffbeb] ${i % 2 ? "bg-[#fafafa]" : "bg-white"}`}>
                    <td className="px-3 py-2.5"><ResBadge status={r.status} /></td>
                    <td className="px-3 py-2.5 mono text-[12px] font-bold text-[#374151]">#{r.confirmationNo}</td>
                    <td className="px-3 py-2.5 mono text-[12px] text-[#9ca3af] font-semibold">{folio?.folioNo}</td>
                    <td className="px-3 py-2.5 text-[13px] font-bold max-w-[200px] truncate">{g?.fullName}</td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#6b7280]">{countryLabel(g?.nationality ?? "")}</td>
                    <td className="px-3 py-2.5 mono text-[13px] font-bold">{room ? room.number : <span className="text-[11px] text-[#b45309]">Chưa gán</span>}</td>
                    <td className="px-3 py-2.5"><span className="mono text-[11px] px-1.5 py-0.5 bg-[#f3f4f6] rounded-[2px] font-bold">{roomTypeById(state, room?.roomTypeId ?? r.roomTypeId)?.code}</span></td>
                    <td className={`px-3 py-2.5 mono text-[12px] font-semibold ${r.arrivalDate === today ? "text-[#15803d]" : "text-[#374151]"}`}>{fmtDate(r.arrivalDate)}</td>
                    <td className={`px-3 py-2.5 mono text-[12px] font-semibold ${r.departureDate === today ? "text-[#c1121f]" : "text-[#374151]"}`}>{fmtDate(r.departureDate)}</td>
                    <td className="px-3 py-2.5 mono text-[12px] text-[#9ca3af] font-semibold">{r.adults}/{r.children}</td>
                    <td className="px-3 py-2.5 mono text-[12px] text-right font-bold">{money(r.rate)}</td>
                    <td className={`px-3 py-2.5 mono text-[12px] text-right font-bold ${bal > 0 ? "text-[#c1121f]" : "text-[#2d6a4f]"}`}>{money(bal)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6b7280] font-semibold">{r.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
