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
  const cell = (v: number) => (v < 0 ? "bg-dirty-soft text-dirty" : v === 0 ? "bg-occ-soft text-occ-ink" : "text-ink");
  const wk = (d: string) => (d === today ? "bg-dirty-soft" : isWeekend(d) ? "weekend-col" : "");

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
      <div className="bg-surface border-b border-line px-5 py-3 flex items-center gap-5 shrink-0 flex-wrap">
        <input type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)} className="mono text-[13px] font-semibold border border-line rounded-ctl px-2 py-1.5 bg-sunken" />
        <div className="flex items-center border border-line rounded-ctl overflow-hidden">
          <button onClick={() => setStart(d => addDays(d, -7))} className="px-2 py-1.5 hover:bg-line-soft border-r border-line"><ChevronLeft size={13} /></button>
          <button onClick={() => setStart(today)} className="px-3 py-1.5 text-[12px] font-semibold hover:bg-line-soft border-r border-line">Hôm nay</button>
          <button onClick={() => setStart(d => addDays(d, 7))} className="px-2 py-1.5 hover:bg-line-soft"><ChevronRight size={13} /></button>
        </div>
        <label className="flex items-center gap-1.5 text-[13px] text-ink-2 font-medium cursor-pointer"><input type="checkbox" checked={tentative} onChange={e => setTentative(e.target.checked)} className="w-3.5 h-3.5 accent-night" /> Trừ cả Tentative</label>
        <div className="flex items-center gap-2 text-[13px] text-ink-2 ml-auto"><span className="font-semibold">Số ngày</span><input type="number" value={days} min={1} max={31} onChange={e => setDays(Math.max(1, Math.min(31, Number(e.target.value))))} className="mono w-14 border border-line rounded-ctl px-2 py-1 text-[13px] font-semibold bg-sunken text-center" /></div>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="bg-surface border border-line rounded-ctl overflow-hidden">
          <table className="avail-table w-full text-left border-collapse text-[13px]" style={{ minWidth: 900 }}>
            <thead><tr className="border-b-2 border-line bg-sunken">
              <th className="px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-ink-2 font-semibold sticky left-0 bg-sunken z-10 min-w-[180px]">Loại phòng</th>
              <th className="px-3 py-3 text-[11px] uppercase text-ink-2 font-semibold text-center">Tổng</th>
              {g.dates.map(d => <th key={d} className={`px-2 text-center min-w-[52px] ${wk(d)}`}><div className="py-2"><div className={`mono text-[12px] font-semibold ${d === today ? "text-dirty" : isWeekend(d) ? "text-occ-ink" : "text-ink-2"}`}>{fmtDayMonth(d)}</div><div className="text-[9px] uppercase font-semibold text-muted">{weekdayShort(d)}</div></div></th>)}
            </tr></thead>
            <tbody className="divide-y divide-line-soft">
              {g.rows.map(r => (
                <tr key={r.type.id}>
                  <td className="px-4 py-2.5 sticky left-0 bg-surface z-10"><div className="font-semibold text-[13px]">{r.type.name}</div><div className="mono text-[11px] text-muted font-semibold">{r.type.code}</div></td>
                  <td className="px-3 py-2.5 mono font-semibold text-center">{r.total}</td>
                  {r.available.map((v, i) => <td key={i} className={`px-2 py-2.5 text-center ${wk(g.dates[i])}`}><button onClick={() => goTo("Đặt phòng")} title="Đặt phòng" className={`mono text-[13px] font-semibold inline-block w-8 py-0.5 rounded hover:ring-1 hover:ring-muted ${cell(v)}`}>{v}</button></td>)}
                </tr>
              ))}
              <tr className="bg-sunken border-t-2 border-line">
                <td className="px-4 py-2.5 font-semibold sticky left-0 bg-sunken z-10">Phòng còn bán</td><td className="px-3 py-2.5 mono font-semibold text-center">{g.saleable}</td>
                {g.soldTotal.map((s, i) => <td key={i} className={`px-2 py-2.5 text-center mono font-semibold ${wk(g.dates[i])}`}>{g.saleable - s}</td>)}
              </tr>
              <tr><td colSpan={2 + days} className="p-0"><div className="notes-divider" /></td></tr>
              {([["Đã bán", g.soldTotal], ["Khách đến", g.arrivals], ["Khách đi", g.departures]] as Array<[string, number[]]>).map(([l, data]) => (
                <tr key={l}><td className="px-4 py-1.5 text-ink-2 font-medium sticky left-0 bg-surface z-10">{l}</td><td />{data.map((v, i) => <td key={i} className={`px-2 py-1.5 text-center mono text-[12px] font-semibold text-ink-2 ${wk(g.dates[i])}`}>{v}</td>)}</tr>
              ))}
              <tr className="bg-sunken"><td className="px-4 py-1.5 font-semibold sticky left-0 bg-sunken z-10">Công suất</td><td className="px-3 py-1.5 mono text-[11px] text-center text-muted">{g.ooo} OOO</td>
                {g.soldTotal.map((s, i) => { const p = g.saleable ? Math.round((s / g.saleable) * 100) : 0; return <td key={i} className={`px-2 py-1.5 text-center mono text-[12px] font-semibold ${p >= 80 ? "text-dirty" : "text-ink"} ${wk(g.dates[i])}`}>{p}%</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-surface border-t border-line px-5 py-3 flex items-center gap-2 shrink-0">
        <button className="toolbar-btn primary flex items-center gap-1.5" onClick={exportCSV}><Download size={11} /> Xuất CSV</button>
        <button className="toolbar-btn" onClick={() => goTo("Đặt phòng")}>Đặt phòng mới</button>
        <button className="toolbar-btn" onClick={() => goTo("Room Plan")}>Mở Room Plan</button>
        <span className="ml-auto text-[12px] text-muted font-medium">Số phòng trống = tổng phòng loại đó (trừ OOO) − đặt phòng Confirmed/Đang ở{tentative ? "/Tentative" : ""} trong đêm đó</span>
      </div>
    </div>
  );
}
