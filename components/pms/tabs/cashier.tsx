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
        <div><h2 className="text-[20px] font-semibold tracking-tight text-ink">Thu ngân</h2><div className="text-[13px] text-muted mt-0.5">Cashier · folio & giao dịch</div></div>
        <div className="flex border border-line rounded-ctl overflow-hidden shadow-sm">
          <button onClick={() => setView("folios")} className={`px-4 py-2 text-[13px] font-semibold border-r border-line ${view === "folios" ? "bg-night text-white" : "bg-surface text-ink-2"}`}>Folio đang mở</button>
          <button onClick={() => setView("today")} className={`px-4 py-2 text-[13px] font-semibold ${view === "today" ? "bg-night text-white" : "bg-surface text-ink-2"}`}>Giao dịch hôm nay ({txns.length})</button>
        </div>
      </div>

      {view === "folios" && (
        <div className="flex gap-4 items-start">
          <Card className="w-80 shrink-0 overflow-hidden">
            <div className="p-3 border-b border-line-soft space-y-2">
              <input value={q} onChange={e => setQ(e.target.value)} className="w-full border border-line rounded-ctl px-3 py-1.5 text-[13px] font-medium outline-none bg-sunken" placeholder="Tên khách, folio, số phòng…" />
              <label className="flex items-center gap-1.5 text-[12px] text-ink-2 font-semibold cursor-pointer"><input type="checkbox" checked={onlyInHouse} onChange={e => setOnlyInHouse(e.target.checked)} className="w-3.5 h-3.5 accent-night" /> Chỉ khách đang ở</label>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {open.length === 0 && <div className="p-5 text-[12px] text-muted font-medium">Không có folio</div>}
              {open.map(x => (
                <button key={x.f.id} onClick={() => setFolioId(x.f.id)} className={`w-full text-left px-4 py-2.5 border-b border-line-soft hover:bg-sunken ${folioId === x.f.id ? "bg-occ-soft" : ""}`}>
                  <div className="flex items-center justify-between"><span className="mono text-[13px] font-semibold">{x.room?.number ?? "—"}</span><span className={`mono text-[12px] font-semibold ${x.bal > 0 ? "text-dirty" : "text-clean"}`}>{money(x.bal)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium truncate">{x.g?.fullName}</span>{x.r.status !== "checked_in" && <ResBadge status={x.r.status} />}</div>
                  <div className="mono text-[10px] text-muted">Folio #{x.f.folioNo}</div>
                </button>
              ))}
            </div>
          </Card>
          <div className="flex-1 min-w-0">{folioId ? <FolioPanel folioId={folioId} /> : <Card className="p-10 text-center text-[13px] text-muted font-medium">Chọn một folio bên trái để post phát sinh hoặc thu tiền</Card>}</div>
        </div>
      )}

      {view === "today" && (
        <>
          <div className="grid grid-cols-6 gap-3">
            <Card className="p-4"><div className="text-[12px] text-ink-2 font-medium mb-1">Phát sinh</div><div className="mono text-[16px] font-semibold text-dirty">{money(charges)}</div></Card>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <Card key={m} className="p-4"><div className="text-[12px] text-ink-2 font-medium mb-1">{PAYMENT_METHOD_LABEL[m]}</div><div className="mono text-[16px] font-semibold text-clean">{money(byMethod[m] ?? 0)}</div></Card>)}
          </div>
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-line-soft"><SectionTitle>Giao dịch post hôm nay</SectionTitle></div>
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b border-line-soft bg-sunken">{["Giờ", "Folio", "Phòng", "Khách", "Code", "Mô tả", "Hình thức", "Người post", "Số tiền"].map(h => <th key={h} className="px-3 py-2.5 text-[10px] tracking-[0.1em] uppercase text-ink-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {txns.length === 0 && <EmptyRow cols={9} text="Chưa có giao dịch hôm nay" />}
                {txns.map(t => { const f = state.folios.find(x => x.id === t.folioId); const r = state.reservations.find(x => x.id === f?.reservationId); return (
                  <tr key={t.id} onClick={() => { if (f) { setFolioId(f.id); setView("folios"); setOnlyInHouse(false); } }} className="border-b border-sunken hover:bg-sunken cursor-pointer">
                    <td className="px-3 py-2 mono text-muted">{fmtTime(t.postedAt)}</td><td className="px-3 py-2 mono">#{f?.folioNo}</td><td className="px-3 py-2 mono font-semibold">{roomById(state, r?.roomId ?? null)?.number ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{r ? guestById(state, r.guestId)?.fullName : ""}</td><td className="px-3 py-2 mono text-[11px] font-semibold">{t.code}</td><td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2 text-ink-2">{t.paymentMethod ? PAYMENT_METHOD_LABEL[t.paymentMethod] : "—"}</td><td className="px-3 py-2 text-[11px] text-muted">{t.postedBy}</td>
                    <td className={`px-3 py-2 mono text-right font-semibold ${t.kind === "debit" ? "text-dirty" : "text-clean"}`}>{t.kind === "credit" ? "-" : ""}{money(t.amount)}</td>
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
