"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { addDays, fmtDayMonth, isWeekend, weekdayShort } from "@/lib/pms/format";
import { availabilityGrid } from "@/lib/pms/selectors";
import { useNav } from "../nav";

export function AvailabilityTab() {
  const { state, session, today } = usePms();
  const { goTo } = useNav();
  const [start, setStart] = useState(today);
  const [days, setDays] = useState(14);
  const [tentative, setTentative] = useState(true);
  const g = availabilityGrid(state, session.branchId, start, days, tentative);
  const cell = (v: number) => (v < 0 ? "bg-[#fde8e8] text-[#c1121f]" : v === 0 ? "bg-[#fff8e1] text-[#7a5800]" : "text-[#1a1a1a]");
  const wk = (d: string) => (d === today ? "bg-[#fff1f2]" : isWeekend(d) ? "weekend-col" : "");

  const exportCSV = () => {
    const head = ["Loại", "Tên", "Tổng", ...g.dates];
    const rows = g.rows.map(r => [r.type.code, r.type.name, r.total, ...r.available]);
    const occ = ["", "Công suất %", g.saleable, ...g.soldTotal.map(s => (g.saleable ? Math.round((s / g.saleable) * 100) : 0))];
    const csv = [head, ...rows, occ].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `availability_${start}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="bg-white border-b border-[#e5e7eb] px-5 py-3 flex items-center gap-5 shrink-0 shadow-sm flex-wrap">
        <input type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)} className="mono text-[13px] font-bold border border-[#e5e7eb] rounded-[3px] px-2 py-1.5 bg-[#fafafa]" />
        <div className="flex items-center border border-[#e5e7eb] rounded-[3px] overflow-hidden">
          <button onClick={() => setStart(d => addDays(d, -7))} className="px-2 py-1.5 hover:bg-[#f3f4f6] border-r border-[#e5e7eb]"><ChevronLeft size={13} /></button>
          <button onClick={() => setStart(today)} className="px-3 py-1.5 text-[12px] font-bold hover:bg-[#f3f4f6] border-r border-[#e5e7eb]">Hôm nay</button>
          <button onClick={() => setStart(d => addDays(d, 7))} className="px-2 py-1.5 hover:bg-[#f3f4f6]"><ChevronRight size={13} /></button>
        </div>
        <label className="flex items-center gap-1.5 text-[13px] text-[#6b7280] font-semibold cursor-pointer"><input type="checkbox" checked={tentative} onChange={e => setTentative(e.target.checked)} className="w-3.5 h-3.5 accent-[#0f0f0e]" /> Trừ cả Tentative</label>
        <div className="flex items-center gap-2 text-[13px] text-[#6b7280] ml-auto"><span className="font-bold">Số ngày</span><input type="number" value={days} min={1} max={31} onChange={e => setDays(Math.max(1, Math.min(31, Number(e.target.value))))} className="mono w-14 border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold bg-[#fafafa] text-center" /></div>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden">
          <table className="avail-table w-full text-left border-collapse text-[13px]" style={{ minWidth: 900 }}>
            <thead><tr className="border-b-2 border-[#e5e7eb] bg-[#fafafa]">
              <th className="px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[#6b7280] font-bold sticky left-0 bg-[#fafafa] z-10 min-w-[180px]">Loại phòng</th>
              <th className="px-3 py-3 text-[11px] uppercase text-[#6b7280] font-bold text-center">Tổng</th>
              {g.dates.map(d => <th key={d} className={`px-2 text-center min-w-[52px] ${wk(d)}`}><div className="py-2"><div className={`mono text-[12px] font-bold ${d === today ? "text-[#c1121f]" : isWeekend(d) ? "text-[#b45309]" : "text-[#374151]"}`}>{fmtDayMonth(d)}</div><div className="text-[9px] uppercase font-bold text-[#9ca3af]">{weekdayShort(d)}</div></div></th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {g.rows.map(r => (
                <tr key={r.type.id}>
                  <td className="px-4 py-2.5 sticky left-0 bg-white z-10"><div className="font-bold text-[13px]">{r.type.name}</div><div className="mono text-[11px] text-[#9ca3af] font-bold">{r.type.code}</div></td>
                  <td className="px-3 py-2.5 mono font-bold text-center">{r.total}</td>
                  {r.available.map((v, i) => <td key={i} className={`px-2 py-2.5 text-center ${wk(g.dates[i])}`}><button onClick={() => goTo("Đặt phòng")} title="Đặt phòng" className={`mono text-[13px] font-bold inline-block w-8 py-0.5 rounded-[2px] hover:ring-1 hover:ring-[#9ca3af] ${cell(v)}`}>{v}</button></td>)}
                </tr>
              ))}
              <tr className="bg-[#fafafa] border-t-2 border-[#e5e7eb]">
                <td className="px-4 py-2.5 font-bold sticky left-0 bg-[#fafafa] z-10">Phòng còn bán</td><td className="px-3 py-2.5 mono font-bold text-center">{g.saleable}</td>
                {g.soldTotal.map((s, i) => <td key={i} className={`px-2 py-2.5 text-center mono font-bold ${wk(g.dates[i])}`}>{g.saleable - s}</td>)}
              </tr>
              <tr><td colSpan={2 + days} className="p-0"><div className="notes-divider" /></td></tr>
              {([["Đã bán", g.soldTotal], ["Khách đến", g.arrivals], ["Khách đi", g.departures]] as Array<[string, number[]]>).map(([l, data]) => (
                <tr key={l}><td className="px-4 py-1.5 text-[#6b7280] font-semibold sticky left-0 bg-white z-10">{l}</td><td />{data.map((v, i) => <td key={i} className={`px-2 py-1.5 text-center mono text-[12px] font-bold text-[#374151] ${wk(g.dates[i])}`}>{v}</td>)}</tr>
              ))}
              <tr className="bg-[#fafafa]"><td className="px-4 py-1.5 font-bold sticky left-0 bg-[#fafafa] z-10">Công suất</td><td className="px-3 py-1.5 mono text-[11px] text-center text-[#9ca3af]">{g.ooo} OOO</td>
                {g.soldTotal.map((s, i) => { const p = g.saleable ? Math.round((s / g.saleable) * 100) : 0; return <td key={i} className={`px-2 py-1.5 text-center mono text-[12px] font-bold ${p >= 80 ? "text-[#c1121f]" : "text-[#1a1a1a]"} ${wk(g.dates[i])}`}>{p}%</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white border-t border-[#e5e7eb] px-5 py-3 flex items-center gap-2 shrink-0">
        <button className="toolbar-btn primary flex items-center gap-1.5" onClick={exportCSV}><Download size={11} /> Xuất CSV</button>
        <button className="toolbar-btn" onClick={() => goTo("Đặt phòng")}>Đặt phòng mới</button>
        <button className="toolbar-btn" onClick={() => goTo("Room Plan")}>Mở Room Plan</button>
        <span className="ml-auto text-[12px] text-[#9ca3af] font-semibold">Số phòng trống = tổng phòng loại đó (trừ OOO) − đặt phòng Confirmed/Đang ở{tentative ? "/Tentative" : ""} trong đêm đó</span>
      </div>
    </div>
  );
}
