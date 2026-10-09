"use client";
import { useState } from "react";
import { usePms } from "@/lib/pms/store";
import { fmtTime, money, PAYMENT_METHOD_LABEL } from "@/lib/pms/format";
import { folioTotals, guestById, roomById, txnsOnDate } from "@/lib/pms/selectors";
import type { PaymentMethod } from "@/lib/pms/types";
import { FolioPanel } from "../folio";
import { useNav } from "../nav";
import { Card, EmptyRow, ResBadge, SectionTitle } from "../ui";

export function CashierTab() {
  const { state, session, today } = usePms();
  const { intent } = useNav();
  const [view, setView] = useState<"folios" | "today">("folios");
  const [q, setQ] = useState("");
  const [onlyInHouse, setOnlyInHouse] = useState(true);
  const [folioId, setFolioId] = useState<string | null>(intent.folioId ?? null);

  const open = state.folios.filter(f => f.branchId === session.branchId && f.status === "open").map(f => {
    const r = state.reservations.find(x => x.id === f.reservationId)!;
    return { f, r, g: guestById(state, r.guestId), room: roomById(state, r.roomId), bal: folioTotals(state, f.id).balance };
  }).filter(x => (!onlyInHouse || x.r.status === "checked_in") && (!q || x.g?.fullName.toLowerCase().includes(q.toLowerCase()) || x.f.folioNo.includes(q) || x.room?.number === q))
    .sort((a, b) => (a.room?.number ?? "~").localeCompare(b.room?.number ?? "~"));
  const txns = txnsOnDate(state, session.branchId, today);
  const byMethod = txns.filter(t => t.kind === "credit" && t.paymentMethod).reduce<Record<string, number>>((a, t) => { a[t.paymentMethod!] = (a[t.paymentMethod!] ?? 0) + t.amount; return a; }, {});
  const charges = txns.filter(t => t.kind === "debit").reduce((a, t) => a + t.amount, 0);

  return (
    <div className="p-7 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-[16px] font-bold">Thu ngân</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Cashier · folio & giao dịch</div></div>
        <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={() => setView("folios")} className={`px-4 py-2 text-[13px] font-bold border-r border-[#e5e7eb] ${view === "folios" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}>Folio đang mở</button>
          <button onClick={() => setView("today")} className={`px-4 py-2 text-[13px] font-bold ${view === "today" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}>Giao dịch hôm nay ({txns.length})</button>
        </div>
      </div>

      {view === "folios" && (
        <div className="flex gap-4 items-start">
          <Card className="w-80 shrink-0 overflow-hidden">
            <div className="p-3 border-b border-[#f3f4f6] space-y-2">
              <input value={q} onChange={e => setQ(e.target.value)} className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-1.5 text-[13px] font-semibold outline-none bg-[#fafafa]" placeholder="Tên khách, folio, số phòng..." />
              <label className="flex items-center gap-1.5 text-[12px] text-[#6b7280] font-bold cursor-pointer"><input type="checkbox" checked={onlyInHouse} onChange={e => setOnlyInHouse(e.target.checked)} className="w-3.5 h-3.5 accent-[#0f0f0e]" /> Chỉ khách đang ở</label>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {open.length === 0 && <div className="p-5 text-[12px] text-[#9ca3af] font-semibold">Không có folio</div>}
              {open.map(x => (
                <button key={x.f.id} onClick={() => setFolioId(x.f.id)} className={`w-full text-left px-4 py-2.5 border-b border-[#f3f4f6] hover:bg-[#fafafa] ${folioId === x.f.id ? "bg-[#fffbeb]" : ""}`}>
                  <div className="flex items-center justify-between"><span className="mono text-[13px] font-bold">{x.room?.number ?? "—"}</span><span className={`mono text-[12px] font-bold ${x.bal > 0 ? "text-[#c1121f]" : "text-[#15803d]"}`}>{money(x.bal)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold truncate">{x.g?.fullName}</span>{x.r.status !== "checked_in" && <ResBadge status={x.r.status} />}</div>
                  <div className="mono text-[10px] text-[#9ca3af]">Folio #{x.f.folioNo}</div>
                </button>
              ))}
            </div>
          </Card>
          <div className="flex-1 min-w-0">{folioId ? <FolioPanel folioId={folioId} /> : <Card className="p-10 text-center text-[13px] text-[#9ca3af] font-semibold">Chọn một folio bên trái để post phát sinh hoặc thu tiền</Card>}</div>
        </div>
      )}

      {view === "today" && (
        <>
          <div className="grid grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] font-bold mb-1">Phát sinh</div><div className="mono text-[16px] font-bold text-[#c1121f]">{money(charges)}</div></Card>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <Card key={m} className="p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] font-bold mb-1">{PAYMENT_METHOD_LABEL[m]}</div><div className="mono text-[16px] font-bold text-[#2d6a4f]">{money(byMethod[m] ?? 0)}</div></Card>)}
          </div>
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-[#f3f4f6]"><SectionTitle>Giao dịch post hôm nay</SectionTitle></div>
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Giờ", "Folio", "Phòng", "Khách", "Code", "Mô tả", "Hình thức", "Người post", "Số tiền"].map(h => <th key={h} className="px-3 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
              <tbody>
                {txns.length === 0 && <EmptyRow cols={9} text="Chưa có giao dịch hôm nay" />}
                {txns.map(t => { const f = state.folios.find(x => x.id === t.folioId); const r = state.reservations.find(x => x.id === f?.reservationId); return (
                  <tr key={t.id} onClick={() => { if (f) { setFolioId(f.id); setView("folios"); setOnlyInHouse(false); } }} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] cursor-pointer">
                    <td className="px-3 py-2 mono text-[#9ca3af]">{fmtTime(t.postedAt)}</td><td className="px-3 py-2 mono">#{f?.folioNo}</td><td className="px-3 py-2 mono font-bold">{roomById(state, r?.roomId ?? null)?.number ?? "—"}</td>
                    <td className="px-3 py-2 font-semibold">{r ? guestById(state, r.guestId)?.fullName : ""}</td><td className="px-3 py-2 mono text-[11px] font-bold">{t.code}</td><td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2 text-[#6b7280]">{t.paymentMethod ? PAYMENT_METHOD_LABEL[t.paymentMethod] : "—"}</td><td className="px-3 py-2 text-[11px] text-[#9ca3af]">{t.postedBy}</td>
                    <td className={`px-3 py-2 mono text-right font-bold ${t.kind === "debit" ? "text-[#c1121f]" : "text-[#2d6a4f]"}`}>{t.kind === "credit" ? "-" : ""}{money(t.amount)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
