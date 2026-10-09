"use client";
import { useMemo, useState } from "react";
import { CheckCircle, Globe, Printer } from "lucide-react";
import { usePms, type GuestInput } from "@/lib/pms/store";
import { addDays, diffDays, fmtDate, money, PAYMENT_METHOD_LABEL, VAT_RATE } from "@/lib/pms/format";
import { branchRoomTypes, freeRooms, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { BookingSource, Guest, GuestType, MealPlan, PaymentMethod, Reservation } from "@/lib/pms/types";
import { emptyGuest, GuestFields, guestToInput } from "../guest-form";
import { useNav } from "../nav";
import { Card, ErrorBox, FieldRow, inputCls, SectionTitle, selectCls, textareaCls } from "../ui";

const SOURCES: BookingSource[] = ["Direct", "Walk-in", "Booking.com", "Agoda", "Expedia", "Traveloka", "Travel Agent"];
const MEALS: Array<[MealPlan, string]> = [["RO", "RO — Room Only"], ["BB", "BB — Bed & Breakfast"], ["HB", "HB — Half Board"], ["FB", "FB — Full Board"]];

export function ReservationTab() {
  const { state, session, today, actions } = usePms();
  const { intent, openOverlay, goTo } = useNav();
  const types = branchRoomTypes(state, session.branchId);
  const [guestType, setGuestType] = useState<GuestType>("vietnamese");
  const [guest, setGuest] = useState<GuestInput>(emptyGuest("vietnamese"));
  const [existing, setExisting] = useState<Guest | null>(null);
  const [lookup, setLookup] = useState("");
  // Mở từ "Walk-in" trên sơ đồ phòng / tổng quan: điền sẵn phòng và nguồn
  const prefillRoom = intent.reservation?.roomId ? roomById(state, intent.reservation.roomId) : undefined;
  const [roomTypeId, setRoomTypeId] = useState(prefillRoom?.roomTypeId ?? types[0]?.id ?? "");
  const [roomId, setRoomId] = useState(prefillRoom?.id ?? "");
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(addDays(today, 1));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rate, setRate] = useState(roomTypeById(state, prefillRoom?.roomTypeId ?? types[0]?.id ?? "")?.baseRate ?? 0);
  const [meal, setMeal] = useState<MealPlan>("BB");
  const [source, setSource] = useState<BookingSource>(intent.reservation?.walkIn ? "Walk-in" : "Direct");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Reservation | null>(null);

  const nights = Math.max(0, diffDays(arrival, departure));
  const rt = roomTypeById(state, roomTypeId);
  const available = useMemo(() => (nights > 0 ? freeRooms(state, session.branchId, arrival, departure, { roomTypeId }) : []), [state, session.branchId, arrival, departure, roomTypeId, nights]);
  const selRoom = available.find(r => r.id === roomId);
  const tax = Math.round(rate * VAT_RATE);
  const canWalkIn = arrival === today && !!selRoom && selRoom.hkStatus === "clean";
  const matches = lookup.trim().length >= 2 ? state.guests.filter(g => g.branchId === session.branchId && (g.fullName.toLowerCase().includes(lookup.toLowerCase()) || g.phone.includes(lookup) || g.idNumber.toLowerCase().includes(lookup.toLowerCase()))).slice(0, 5) : [];

  const switchType = (t: GuestType) => { setGuestType(t); setExisting(null); setGuest(emptyGuest(t)); };
  const pickGuest = (g: Guest) => { setExisting(g); setGuestType(g.guestType); setGuest(guestToInput(g)); setLookup(""); };
  const changeType = (id: string) => { setRoomTypeId(id); setRoomId(""); setRate(roomTypeById(state, id)?.baseRate ?? 0); };
  const reset = () => { setCreated(null); setExisting(null); setGuest(emptyGuest(guestType)); setRoomId(""); setDeposit(""); setNote(""); setError(null); setSource("Direct"); setArrival(today); setDeparture(addDays(today, 1)); };

  const save = (status: "confirmed" | "tentative", walkIn = false) => {
    if (existing) { const u = actions.updateGuest(existing.id, guest); if (!u.ok) return setError(u.error); }
    const r = actions.createReservation({
      guestId: existing?.id, guest: existing ? undefined : guest, roomTypeId, roomId: roomId || null, arrivalDate: arrival, departureDate: departure,
      adults, children, rate, mealPlan: meal, source: walkIn ? "Walk-in" : source, status, note,
      deposit: Number(deposit) > 0 ? { amount: Number(deposit), method } : undefined,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    if (walkIn) {
      const c = actions.checkIn(r.value.id);
      if (!c.ok) { setCreated(r.value); return setError(`Đã tạo đặt phòng nhưng chưa check-in được: ${c.error}`); }
    }
    setCreated(r.value);
  };

  if (created) {
    const res = state.reservations.find(r => r.id === created.id) ?? created;
    const room = roomById(state, res.roomId);
    return (
      <div className="p-7 max-w-3xl mx-auto flex flex-col items-center gap-4 py-16">
        <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center shadow-md"><CheckCircle size={28} className="text-[#2d6a4f]" strokeWidth={1.5} /></div>
        <h2 className="text-[16px] font-bold">{res.status === "checked_in" ? "Walk-in đã nhận phòng" : "Đã lưu đặt phòng"}</h2>
        <Card className="px-8 py-5 w-96 space-y-2 text-[13px]">
          {([["Số xác nhận", `#${res.confirmationNo}`], ["Khách", state.guests.find(g => g.id === res.guestId)?.fullName ?? ""], ["Phòng", room ? `${room.number} · ${rt?.code}` : `Chưa gán · ${rt?.code}`], ["Lưu trú", `${fmtDate(res.arrivalDate)} → ${fmtDate(res.departureDate)}`], ["Trạng thái", res.status]] as Array<[string, string]>).map(([l, v]) => <div key={l} className="flex justify-between border-b border-[#f3f4f6] pb-2"><span className="text-[#9ca3af] font-semibold">{l}</span><span className="mono font-bold">{v}</span></div>)}
        </Card>
        <ErrorBox message={error} />
        <div className="flex gap-2 flex-wrap justify-center">
          {res.status !== "checked_in" && res.arrivalDate === today && <button onClick={() => openOverlay({ kind: "checkin", reservationId: res.id })} className="pms-btn-primary">Check-in ngay</button>}
          <button onClick={() => openOverlay({ kind: "folio", reservationId: res.id })} className="pms-btn-secondary">Xem folio</button>
          <button onClick={() => goTo("Room Plan")} className="pms-btn-secondary">Xem trên Room Plan</button>
          <button onClick={() => window.print()} className="pms-btn-secondary"><Printer size={13} strokeWidth={1.5} /> In xác nhận</button>
          <button onClick={reset} className="pms-btn-secondary">+ Đặt phòng khác</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-[16px] font-bold text-[#1a1a1a]">Đặt phòng mới</h2><div className="text-[12px] text-[#9ca3af] mt-0.5 mono font-semibold">New Reservation · Walk-in</div></div>
        <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={() => switchType("vietnamese")} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold border-r border-[#e5e7eb] ${guestType === "vietnamese" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}>🇻🇳 Khách Việt Nam</button>
          <button onClick={() => switchType("foreign")} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold ${guestType === "foreign" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}><Globe size={15} strokeWidth={1.5} /> Khách nước ngoài</button>
        </div>
      </div>

      <Card className="p-6 mb-4">
        <div className="grid grid-cols-2 gap-x-8">
          <div className="space-y-3">
            <SectionTitle>Thông tin khách</SectionTitle>
            <div className="relative">
              {existing
                ? <div className="flex items-center justify-between px-3 py-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-[3px] text-[12px] font-bold text-[#1d4ed8]">Khách cũ: {existing.fullName}<button onClick={() => { setExisting(null); setGuest(emptyGuest(guestType)); }} className="text-[#6b7280] hover:text-[#c1121f]">Bỏ chọn ✕</button></div>
                : <input className={inputCls} value={lookup} onChange={e => setLookup(e.target.value)} placeholder="🔎 Tìm khách cũ theo tên / SĐT / giấy tờ..." />}
              {matches.length > 0 && <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-[3px] shadow-lg">{matches.map(g => <button key={g.id} onClick={() => pickGuest(g)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#f3f4f6] border-b border-[#f3f4f6]"><b>{g.fullName}</b> <span className="text-[#9ca3af] mono text-[11px]">{g.idNumber} {g.phone}</span></button>)}</div>}
            </div>
            <GuestFields value={guest} onChange={setGuest} />
          </div>
          <div className="space-y-3">
            <SectionTitle>Chi tiết đặt phòng</SectionTitle>
            <FieldRow label="Ngày đến" required><input type="date" min={today} className={inputCls} value={arrival} onChange={e => { setArrival(e.target.value); setRoomId(""); if (e.target.value >= departure) setDeparture(addDays(e.target.value, 1)); }} /></FieldRow>
            <FieldRow label="Ngày đi" required><input type="date" min={addDays(arrival, 1)} className={inputCls} value={departure} onChange={e => { setDeparture(e.target.value); setRoomId(""); }} /></FieldRow>
            <FieldRow label="Số đêm"><input className={inputCls} readOnly value={nights} /></FieldRow>
            <FieldRow label="Loại phòng" required><select className={selectCls} value={roomTypeId} onChange={e => changeType(e.target.value)}>{types.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name} ({money(t.baseRate)}₫)</option>)}</select></FieldRow>
            <FieldRow label="Số phòng"><select className={selectCls} value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Chưa gán (gán sau)</option>
              {available.map(r => <option key={r.id} value={r.id}>Phòng {r.number} · Tầng {r.floor}{r.hkStatus === "dirty" ? " · chờ dọn" : ""}</option>)}
            </select></FieldRow>
            <div className="text-[11px] text-[#9ca3af] font-semibold text-right -mt-1">{available.length} phòng {rt?.code} trống cho {nights} đêm</div>
            <FieldRow label="Người lớn / trẻ em"><div className="flex gap-2"><input type="number" min={1} className={inputCls} value={adults} onChange={e => setAdults(Number(e.target.value))} /><input type="number" min={0} className={inputCls} value={children} onChange={e => setChildren(Number(e.target.value))} /></div></FieldRow>
            <FieldRow label="Giá / đêm (₫)"><input type="number" min={0} className={inputCls} value={rate} onChange={e => setRate(Number(e.target.value))} /></FieldRow>
            <FieldRow label="Meal plan"><select className={selectCls} value={meal} onChange={e => setMeal(e.target.value as MealPlan)}>{MEALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FieldRow>
            <FieldRow label="Nguồn"><select className={selectCls} value={source} onChange={e => setSource(e.target.value as BookingSource)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></FieldRow>
            <FieldRow label="Đặt cọc (₫)"><div className="flex gap-2"><input type="number" min={0} className={inputCls} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" /><select className={selectCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).filter(m => m !== "city_ledger").map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}</select></div></FieldRow>
            <FieldRow label="Ghi chú"><textarea className={`${textareaCls} h-16`} value={note} onChange={e => setNote(e.target.value)} placeholder="Yêu cầu đặc biệt..." /></FieldRow>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="px-6 py-4 border-b border-[#f3f4f6]"><SectionTitle>Tiền phòng dự kiến</SectionTitle></div>
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Đêm", "Loại", "Đơn giá", "VAT 8%", "Thành tiền"].map(h => <th key={h} className="px-4 py-2 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
          <tbody>{Array.from({ length: Math.min(nights, 14) }, (_, i) => addDays(arrival, i)).map(d => <tr key={d} className="border-b border-[#f9f9f7]"><td className="px-4 py-2 mono font-semibold">{fmtDate(d)}</td><td className="px-4 py-2 font-semibold text-[#6b7280]">{rt?.code}</td><td className="px-4 py-2 mono font-bold">{money(rate)}</td><td className="px-4 py-2 mono text-[#6b7280]">{money(tax)}</td><td className="px-4 py-2 mono font-bold">{money(rate + tax)}</td></tr>)}</tbody>
        </table>
        <div className="flex justify-between items-center px-4 py-2.5 border-t border-[#e5e7eb] bg-[#fafafa]"><span className="text-[12px] text-[#6b7280] uppercase font-bold">Tổng {nights} đêm (gồm VAT){Number(deposit) > 0 ? ` · cọc ${money(Number(deposit))}₫` : ""}</span><span className="mono font-bold text-[14px]">{money(nights * (rate + tax))} ₫</span></div>
      </Card>

      <ErrorBox message={error} />
      <div className="flex items-center gap-2 flex-wrap mt-4">
        <button onClick={() => save("confirmed")} className="pms-btn-primary">Lưu — Confirmed</button>
        <button onClick={() => save("tentative")} className="pms-btn-secondary">Lưu — Tentative</button>
        <button onClick={() => save("confirmed", true)} disabled={!canWalkIn} title={canWalkIn ? "" : "Cần ngày đến hôm nay và chọn phòng đã dọn sạch"} className="pms-btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">Walk-in: lưu & check-in ngay</button>
        <div className="flex-1" />
        <button onClick={reset} className="px-5 py-2.5 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5]">Xóa form</button>
      </div>
    </div>
  );
}
