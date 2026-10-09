"use client";
import { useState } from "react";
import { Plus, Printer } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { CHARGE_CODES, fmtDate, money, PAYMENT_METHOD_LABEL, TXN_CODE_LABEL } from "@/lib/pms/format";
import { folioTotals, folioTransactions, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { PaymentMethod, TxnCode } from "@/lib/pms/types";
import { Card, ErrorBox, FieldRow, inputCls, ResBadge, SectionTitle, selectCls, Stat } from "./ui";

const POSTABLE: TxnCode[] = [...CHARGE_CODES, "PAYMENT", "DEPOSIT", "DISCOUNT"];

/** Folio của một đặt phòng: xem giao dịch, post phát sinh / thu tiền, void. Dùng chung cho Check-out, Thu ngân, Sơ đồ phòng. */
export function FolioPanel({ folioId, showHeader = true }: { folioId: string; showHeader?: boolean }) {
  const { state, actions } = usePms();
  const folio = state.folios.find(f => f.id === folioId);
  const [showVoided, setShowVoided] = useState(false);
  const [form, setForm] = useState<{ open: boolean; code: TxnCode; description: string; amount: string; method: PaymentMethod }>({ open: false, code: "MINIBAR", description: "", amount: "", method: "cash_vnd" });
  const [error, setError] = useState<string | null>(null);
  if (!folio) return <ErrorBox message="Không tìm thấy folio" />;
  const res = state.reservations.find(r => r.id === folio.reservationId)!;
  const guest = guestById(state, res.guestId);
  const room = roomById(state, res.roomId);
  const rt = roomTypeById(state, room?.roomTypeId ?? res.roomTypeId);
  const txns = folioTransactions(state, folio.id, showVoided);
  const { debit, credit, balance } = folioTotals(state, folio.id);
  const isCredit = ["PAYMENT", "DEPOSIT", "DISCOUNT"].includes(form.code);
  const closed = folio.status === "closed";

  const submit = async () => {
    const r = await actions.postTransaction(folio.id, { code: form.code, description: form.description || TXN_CODE_LABEL[form.code], amount: Number(form.amount), paymentMethod: isCredit && form.code !== "DISCOUNT" ? form.method : null });
    if (!r.ok) return setError(r.error);
    setError(null); setForm(f => ({ ...f, open: false, description: "", amount: "" }));
  };
  const voidTxn = async (id: string, label: string) => {
    if (!window.confirm(`Void giao dịch "${label}"? Giao dịch vẫn được lưu vết nhưng không còn tính vào số dư.`)) return;
    const r = await actions.voidTransaction(id);
    setError(r.ok ? null : r.error);
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <Card className="px-6 py-4 flex items-center gap-8 flex-wrap">
          <Stat label="Khách" value={guest?.fullName ?? "—"} />
          <Stat label="Folio" value={`#${folio.folioNo}`} />
          <Stat label="Đặt phòng" value={`#${res.confirmationNo}`} />
          <Stat label="Phòng" value={room ? `${room.number} · ${rt?.code}` : `Chưa gán · ${rt?.code}`} />
          <Stat label="Đến" value={fmtDate(res.arrivalDate)} />
          <Stat label="Đi" value={fmtDate(res.departureDate)} />
          <div><div className="text-[12px] text-muted mb-0.5">Trạng thái</div><ResBadge status={res.status} /></div>
          <div className="flex-1" />
          <span className={`mono text-[13px] font-semibold px-3 py-1 rounded-ctl border ${balance > 0 ? "bg-dirty-soft text-dirty border-dirty-line" : "bg-clean-soft text-clean border-clean-line"}`}>Số dư: {money(balance)} ₫</span>
        </Card>
      )}

      <div className="flex items-center gap-2">
        {!closed && <button onClick={() => setForm(f => ({ ...f, open: !f.open }))} className="pms-btn-secondary"><Plus size={12} strokeWidth={2} /> Post giao dịch</button>}
        <button onClick={() => window.print()} className="pms-btn-secondary"><Printer size={12} strokeWidth={1.5} /> In folio</button>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-2 font-medium cursor-pointer ml-2"><input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} className="w-3.5 h-3.5 accent-night" /> Hiện giao dịch đã void</label>
        {closed && <span className="ml-auto text-[12px] font-semibold text-ink-2">Folio đã đóng, chỉ xem</span>}
      </div>

      {form.open && !closed && (
        <Card className="p-5 border-occ-line">
          <SectionTitle>Post giao dịch mới</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <FieldRow label="Loại"><select className={selectCls} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value as TxnCode }))}>{POSTABLE.map(c => <option key={c} value={c}>{c} · {TXN_CODE_LABEL[c]}</option>)}</select></FieldRow>
            <FieldRow label="Số tiền (₫)"><input className={inputCls} type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" /></FieldRow>
            <FieldRow label="Mô tả"><input className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={TXN_CODE_LABEL[form.code]} /></FieldRow>
            {isCredit && form.code !== "DISCOUNT"
              ? <FieldRow label="Hình thức"><select className={selectCls} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>{(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</select></FieldRow>
              : <FieldRow label="Ghi sổ"><div className={`text-[12px] font-semibold px-3 py-2 rounded-ctl ${isCredit ? "bg-clean-soft text-clean" : "bg-dirty-soft text-dirty"}`}>{isCredit ? "Credit: giảm số dư" : "Debit: tăng số dư"}</div></FieldRow>}
          </div>
          <div className="mt-3"><ErrorBox message={error} /></div>
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-line-soft">
            <button onClick={() => { setForm(f => ({ ...f, open: false })); setError(null); }} className="pms-btn-secondary">Hủy</button>
            <button onClick={submit} className="pms-btn-primary"><Plus size={12} strokeWidth={2} /> Thêm vào folio</button>
          </div>
        </Card>
      )}
      {!form.open && <ErrorBox message={error} />}

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead><tr className="border-b border-line-soft bg-sunken">{["Ngày", "Code", "Mô tả", "Hình thức", "Người post", "Debit", "Credit", ""].map(h => <th key={h} className="px-4 py-2.5 text-[10px] tracking-[0.1em] uppercase text-ink-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {txns.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-[13px] text-muted font-medium">Chưa có giao dịch</td></tr>}
            {txns.map(t => (
              <tr key={t.id} className={`border-b border-sunken hover:bg-sunken group ${t.voided ? "opacity-50 line-through" : ""}`}>
                <td className="px-4 py-2.5 mono text-[12px] text-muted font-medium">{fmtDate(t.businessDate)}</td>
                <td className="px-4 py-2.5"><span className="mono text-[11px] px-1.5 py-0.5 bg-line-soft rounded text-ink-2 font-semibold">{t.code}</span></td>
                <td className="px-4 py-2.5 text-[13px] font-semibold">{t.description}</td>
                <td className="px-4 py-2.5 text-[12px] text-ink-2 font-medium">{t.paymentMethod ? PAYMENT_METHOD_LABEL[t.paymentMethod] : "—"}</td>
                <td className="px-4 py-2.5 text-[11px] text-muted font-medium">{t.postedBy}</td>
                <td className="px-4 py-2.5 mono text-[13px] text-right font-semibold text-dirty">{t.kind === "debit" ? money(t.amount) : ""}</td>
                <td className="px-4 py-2.5 mono text-[13px] text-right font-semibold text-clean">{t.kind === "credit" ? money(t.amount) : ""}</td>
                <td className="px-4 py-2.5 text-right">{!closed && !t.voided && <button onClick={() => voidTxn(t.id, t.description)} className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-muted hover:text-dirty transition-all">Void</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 border-t-2 border-line bg-sunken flex justify-end gap-12">
          <div className="text-right"><div className="text-[12px] text-muted mb-1">Tổng debit</div><div className="mono font-semibold text-dirty text-[13px]">{money(debit)} ₫</div></div>
          <div className="text-right"><div className="text-[12px] text-muted mb-1">Tổng credit</div><div className="mono font-semibold text-clean text-[13px]">{money(credit)} ₫</div></div>
          <div className="text-right"><div className="text-[12px] text-muted mb-1">Số dư</div><div className={`mono font-semibold text-[15px] ${balance > 0 ? "text-dirty" : "text-clean"}`}>{money(balance)} ₫</div></div>
        </div>
      </Card>
    </div>
  );
}
