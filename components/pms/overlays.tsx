"use client";
import { useMemo, useState } from "react";
import { CheckCircle, DollarSign, LogOut, Printer } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { diffDays, fmtDate, money, PAYMENT_METHOD_LABEL, VAT_RATE } from "@/lib/pms/format";
import { folioOfReservation, folioTransactions, freeRooms, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { PaymentMethod } from "@/lib/pms/types";
import { FolioPanel } from "./folio";
import { GuestFields, guestToInput } from "./guest-form";
import { useNav } from "./nav";
import { Card, ErrorBox, FieldRow, inputCls, OverlayHeader, ResBadge, SectionTitle, selectCls, Stat } from "./ui";

const PAY_METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-40 bg-[#f2f2ef] flex flex-col overflow-y-auto">{children}</div>;
}
function Done({ title, lines, actions }: { title: string; lines: Array<[string, string]>; actions: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-16 h-16 rounded-full bg-[#f0fdf4] flex items-center justify-center shadow-lg"><CheckCircle size={28} className="text-[#2d6a4f]" strokeWidth={1.5} /></div>
      <div className="text-[16px] font-bold">{title}</div>
      <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.1)] px-8 py-5 space-y-2 text-[13px] w-80">
        {lines.map(([l, v]) => <div key={l} className="flex justify-between border-b border-[#f3f4f6] pb-2"><span className="text-[#9ca3af] font-semibold">{l}</span><span className="mono font-bold text-[#374151]">{v}</span></div>)}
      </div>
      <div className="flex gap-3 mt-2">{actions}</div>
    </div>
  );
}

// ─── CHECK-IN ───
export function CheckInOverlay({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const { state, actions, today, session } = usePms();
  const { openOverlay } = useNav();
  const res = state.reservations.find(r => r.id === reservationId)!;
  const guest = guestById(state, res.guestId)!;
  const [g, setG] = useState(() => guestToInput(guest));
  const [roomId, setRoomId] = useState(res.roomId ?? "");
  const [allTypes, setAllTypes] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash_vnd");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const bookedType = roomTypeById(state, res.roomTypeId);
  const from = res.arrivalDate < today ? today : res.arrivalDate;
  const nights = Math.max(0, diffDays(from, res.departureDate));
  const options = useMemo(() => {
    const list = freeRooms(state, session.branchId, from, res.departureDate, { roomTypeId: allTypes ? null : res.roomTypeId, excludeReservationId: res.id });
    const current = roomById(state, res.roomId);
    return current && !list.some(r => r.id === current.id) ? [current, ...list] : list;
  }, [state, session.branchId, from, res, allTypes]);
  const selected = roomById(state, roomId || null);
  const occupant = selected ? state.reservations.find(r => r.roomId === selected.id && r.status === "checked_in") : undefined;
  const canCheckIn = res.status === "confirmed" || res.status === "tentative";

  const confirm = () => {
    if (!roomId) return setError("Chọn phòng trước khi nhận phòng");
    const u = actions.updateGuest(guest.id, g); if (!u.ok) return setError(u.error);
    if (roomId !== res.roomId) { const a = actions.assignRoom(res.id, roomId); if (!a.ok) return setError(a.error); }
    const c = actions.checkIn(res.id, Number(deposit) > 0 ? { amount: Number(deposit), method } : undefined);
    if (!c.ok) return setError(c.error);
    setError(null); setDone(true);
  };
  const cancel = () => {
    if (!window.confirm(`Hủy đặt phòng #${res.confirmationNo}?`)) return;
    const r = actions.cancelReservation(res.id);
    if (!r.ok) return setError(r.error);
    onClose();
  };

  if (done) return <Shell><Done title="Check-in thành công!" lines={[["Khách", g.fullName], ["Phòng", `${selected?.number} · ${roomTypeById(state, selected?.roomTypeId ?? "")?.code}`], ["Đến", fmtDate(from)], ["Đi", fmtDate(res.departureDate)], ["Folio", `#${folioOfReservation(state, res.id)?.folioNo}`]]}
    actions={<><button onClick={() => window.print()} className="pms-btn-secondary"><Printer size={13} strokeWidth={1.5} /> In Reg Card</button><button onClick={() => openOverlay({ kind: "folio", reservationId: res.id })} className="pms-btn-secondary"><DollarSign size={13} strokeWidth={1.5} /> Xem folio</button><button onClick={onClose} className="pms-btn-primary">Đóng</button></>} /></Shell>;

  return (
    <Shell>
      <OverlayHeader title={`Check-in — ${guest.fullName} · #${res.confirmationNo}`} onBack={onClose}>
        <button onClick={() => openOverlay({ kind: "folio", reservationId: res.id })} className="pms-btn-secondary"><DollarSign size={12} strokeWidth={1.5} /> Folio</button>
        {canCheckIn && <button onClick={confirm} className="pms-btn-primary">✓ Xác nhận check-in</button>}
      </OverlayHeader>
      <div className="p-7 max-w-6xl mx-auto w-full space-y-5">
        <Card className="px-6 py-4 flex items-center gap-8 flex-wrap">
          <Stat label="Loại đặt" value={bookedType?.code} /><Stat label="Đến" value={fmtDate(res.arrivalDate)} /><Stat label="Đi" value={fmtDate(res.departureDate)} />
          <Stat label="Số đêm" value={nights} /><Stat label="Khách" value={`${res.adults} NL${res.children ? ` + ${res.children} TE` : ""}`} /><Stat label="Giá/đêm" value={`${money(res.rate)} ₫`} />
          <Stat label="Nguồn" value={res.source} /><Stat label="Meal" value={res.mealPlan} />
          <div><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">Trạng thái</div><ResBadge status={res.status} /></div>
        </Card>
        {res.arrivalDate > today && <ErrorBox message={`Ngày đến là ${fmtDate(res.arrivalDate)} — chỉ nhận phòng được từ ngày đó.`} />}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <Card className="p-6"><SectionTitle>Thông tin khách</SectionTitle><div className="grid grid-cols-1 max-w-xl"><GuestFields value={g} onChange={setG} /></div></Card>
            <Card className={`p-6 ${roomId ? "border-[#86efac]" : "border-[#fcd34d]"}`}>
              <div className="flex items-center justify-between mb-4"><SectionTitle>Gán phòng</SectionTitle>
                <label className="flex items-center gap-1.5 text-[12px] text-[#6b7280] font-semibold cursor-pointer"><input type="checkbox" checked={allTypes} onChange={e => setAllTypes(e.target.checked)} className="w-3.5 h-3.5 accent-[#0f0f0e]" /> Hiện mọi loại phòng (nâng hạng)</label>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <FieldRow label="Số phòng"><select className={selectCls} value={roomId} onChange={e => setRoomId(e.target.value)}>
                  <option value="">— Chọn phòng trống —</option>
                  {options.map(r => <option key={r.id} value={r.id}>Phòng {r.number} · {roomTypeById(state, r.roomTypeId)?.code} · {r.hkStatus === "clean" ? "Sạch" : "Chờ dọn"}</option>)}
                </select></FieldRow>
                {selected && <FieldRow label="Tình trạng"><div className="flex items-center gap-2">
                  {occupant ? <span className="text-[12px] font-bold text-[#c1121f]">Đang có khách</span>
                    : selected.hkStatus === "clean" ? <span className="text-[12px] font-bold text-[#15803d]">● Sạch — sẵn sàng</span>
                      : <><span className="text-[12px] font-bold text-[#c1121f]">● Chờ dọn</span><button onClick={() => { const r = actions.setHousekeeping(selected.id, "clean"); setError(r.ok ? null : r.error); }} className="pms-btn-secondary text-[11px] py-1">Đánh dấu đã dọn</button></>}
                </div></FieldRow>}
              </div>
              {canCheckIn && roomId && roomId !== res.roomId && (
                <div className="flex justify-end mt-3"><button onClick={() => { const r = actions.assignRoom(res.id, roomId); setError(r.ok ? null : r.error); }} className="pms-btn-secondary">Lưu gán phòng (chưa check-in)</button></div>
              )}
              {options.length === 0 && <p className="mt-3 text-[12px] text-[#9ca3af] font-semibold">Không còn phòng {bookedType?.code} trống cho kỳ lưu trú — bật “Hiện mọi loại phòng” để nâng hạng.</p>}
            </Card>
            {res.note && <Card className="p-6"><SectionTitle>Ghi chú đặt phòng</SectionTitle><p className="text-[13px] font-semibold text-[#374151]">{res.note}</p></Card>}
          </div>
          <div className="space-y-4">
            <Card className="p-5"><SectionTitle>Tiền phòng sẽ post</SectionTitle>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-[#9ca3af] font-semibold">{nights} đêm × {money(res.rate)}</span><span className="mono font-bold">{money(nights * res.rate)} ₫</span></div>
                <div className="flex justify-between"><span className="text-[#9ca3af] font-semibold">VAT 8%</span><span className="mono font-bold">{money(nights * Math.round(res.rate * VAT_RATE))} ₫</span></div>
                <div className="flex justify-between pt-2 border-t border-[#e5e7eb] text-[14px]"><span className="font-bold">Tổng</span><span className="mono font-bold text-[#2d6a4f]">{money(nights * (res.rate + Math.round(res.rate * VAT_RATE)))} ₫</span></div>
              </div>
            </Card>
            <Card className="p-5"><SectionTitle>Đặt cọc khi nhận phòng</SectionTitle>
              <div className="space-y-3">
                <FieldRow label="Số tiền"><input className={inputCls} type="number" min={0} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0 ₫" /></FieldRow>
                <FieldRow label="Hình thức"><select className={selectCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{PAY_METHODS.filter(m => m !== "city_ledger").map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</select></FieldRow>
              </div>
            </Card>
            <ErrorBox message={error} />
            {canCheckIn && <button onClick={confirm} className="w-full pms-btn-primary py-3 justify-center">✓ Xác nhận check-in</button>}
            {canCheckIn && <button onClick={cancel} className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5] transition-all">Hủy đặt phòng</button>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── CHECK-OUT ───
export function CheckOutOverlay({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const { state, actions, today } = usePms();
  const { openOverlay } = useNav();
  const res = state.reservations.find(r => r.id === reservationId)!;
  const guest = guestById(state, res.guestId)!;
  const room = roomById(state, res.roomId);
  const folio = folioOfReservation(state, res.id)!;
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash_vnd");
  const [received, setReceived] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ total: number; change: number } | null>(null);
  const early = res.departureDate > today;

  // Xem trước đúng như action checkOut sẽ tính
  const txns = folioTransactions(state, folio.id).filter(t => !(early && (t.code === "ROOM" || t.code === "TAX") && t.businessDate >= today));
  const debit = txns.filter(t => t.kind === "debit").reduce((a, t) => a + t.amount, 0);
  const credit = txns.filter(t => t.kind === "credit").reduce((a, t) => a + t.amount, 0);
  const roomCharges = txns.filter(t => t.code === "ROOM" || t.code === "TAX").reduce((a, t) => a + t.amount, 0);
  const discountAmt = Math.round((roomCharges * Math.min(100, Math.max(0, discount))) / 100);
  const due = debit - credit - discountAmt;
  const receivedNum = received === "" ? Math.max(0, due) : Number(received);
  const groups = Object.entries(txns.filter(t => t.kind === "debit").reduce<Record<string, number>>((acc, t) => { acc[t.code] = (acc[t.code] ?? 0) + t.amount; return acc; }, {}));

  const confirm = () => {
    const r = actions.checkOut(res.id, { discountPercent: discount, payment: due > 0 ? { method, amount: receivedNum } : null });
    if (!r.ok) return setError(r.error);
    setError(null); setResult({ total: Math.max(0, due), change: r.value.change });
  };

  if (result) return <Shell><Done title="Check-out thành công!" lines={[["Khách", guest.fullName], ["Phòng", `${room?.number} → chờ dọn`], ["Đã thu", `${money(result.total)} ₫`], ["Hình thức", PAYMENT_METHOD_LABEL[method]], ["Tiền thừa", `${money(result.change)} ₫`]]}
    actions={<><button onClick={() => window.print()} className="pms-btn-secondary"><Printer size={13} strokeWidth={1.5} /> In hóa đơn</button><button onClick={onClose} className="pms-btn-primary">Đóng</button></>} /></Shell>;

  return (
    <Shell>
      <OverlayHeader title={`Check-out — ${guest.fullName} · phòng ${room?.number ?? "—"}`} onBack={onClose}>
        <button onClick={() => openOverlay({ kind: "folio", reservationId: res.id })} className="pms-btn-secondary"><DollarSign size={12} strokeWidth={1.5} /> Xem & post folio</button>
        <button onClick={confirm} className="pms-btn-danger"><LogOut size={12} strokeWidth={1.5} /> Xác nhận check-out</button>
      </OverlayHeader>
      <div className="p-7 max-w-5xl mx-auto w-full space-y-5">
        <Card className="px-6 py-4 flex items-center gap-8 flex-wrap">
          <Stat label="Phòng" value={room?.number} /><Stat label="Đến" value={fmtDate(res.arrivalDate)} /><Stat label="Đi" value={fmtDate(res.departureDate)} />
          <Stat label="Folio" value={`#${folio.folioNo}`} /><Stat label="Nguồn" value={res.source} />
        </Card>
        {early && <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-[3px] px-4 py-2.5 text-[12px] font-bold text-[#7a5800]">Trả phòng sớm: tiền phòng từ đêm {fmtDate(today)} trở đi sẽ được void tự động.</div>}
        <div className="grid grid-cols-3 gap-5">
          <Card className="col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f3f4f6]"><SectionTitle>Tổng hợp folio</SectionTitle></div>
            <table className="w-full text-left text-[13px]"><tbody>
              {groups.map(([code, amt]) => <tr key={code} className="border-b border-[#f9f9f7]"><td className="px-5 py-2.5 font-bold">{code}</td><td className="px-5 py-2.5 mono text-right font-bold">{money(amt)} ₫</td></tr>)}
              {credit > 0 && <tr className="border-b border-[#f9f9f7]"><td className="px-5 py-2.5 font-bold text-[#2d6a4f]">Đã thanh toán / cọc</td><td className="px-5 py-2.5 mono text-right font-bold text-[#2d6a4f]">-{money(credit)} ₫</td></tr>}
            </tbody></table>
            <div className="px-5 py-3 border-t-2 border-[#e5e7eb] space-y-2 text-[13px]">
              <div className="flex justify-between items-center"><span className="text-[#9ca3af] font-semibold">Giảm giá tiền phòng</span>
                <div className="flex items-center gap-2"><input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="mono w-16 border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold outline-none text-right" /><span className="text-[#9ca3af] font-semibold">%</span><span className="mono text-[#c1121f] font-bold">-{money(discountAmt)} ₫</span></div>
              </div>
              <div className="flex justify-between text-[15px] pt-2 border-t border-[#e5e7eb]"><span className="font-bold">Còn phải thu</span><span className={`mono font-bold ${due > 0 ? "text-[#c1121f]" : "text-[#2d6a4f]"}`}>{money(due)} ₫</span></div>
            </div>
          </Card>
          <div className="space-y-4">
            <Card className="p-5"><SectionTitle>Thanh toán</SectionTitle>
              <div className="space-y-3">
                <FieldRow label="Hình thức"><select className={selectCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} disabled={due <= 0}>{PAY_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</select></FieldRow>
                <FieldRow label="Khách đưa"><input className={inputCls} type="number" value={received} disabled={due <= 0 || method === "city_ledger"} onChange={e => setReceived(e.target.value)} placeholder={money(Math.max(0, due))} /></FieldRow>
                <FieldRow label="Tiền thừa"><input className={inputCls} readOnly value={`${money(Math.max(0, method === "city_ledger" ? 0 : receivedNum - Math.max(0, due)))} ₫`} /></FieldRow>
              </div>
            </Card>
            <ErrorBox message={error} />
            <button onClick={confirm} className="w-full pms-btn-danger justify-center"><LogOut size={14} strokeWidth={1.5} /> Xác nhận check-out</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── FOLIO ───
export function FolioOverlay({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const { state } = usePms();
  const res = state.reservations.find(r => r.id === reservationId)!;
  const folio = folioOfReservation(state, res.id);
  const guest = guestById(state, res.guestId);
  return (
    <div className="fixed inset-0 z-50 bg-[#f2f2ef] flex flex-col overflow-y-auto">
      <OverlayHeader title={`${guest?.fullName} — Folio #${folio?.folioNo}`} onBack={onClose} />
      <div className="p-7 max-w-5xl mx-auto w-full">{folio ? <FolioPanel folioId={folio.id} /> : <ErrorBox message="Đặt phòng chưa có folio" />}</div>
    </div>
  );
}
