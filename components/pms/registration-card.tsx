"use client";
// Phiếu đăng ký lưu trú (Guest Registration Card) in khổ A4 khi khách check-in.
// Bố cục theo mẫu Crystal Reports của Avanti: thông tin khách, phần Hotel Use, điều khoản (Noted/Chú ý)
// và ô ký tên — vừa bảo vệ quyền lợi khách sạn, vừa là minh chứng khách nhận đúng phòng.
// Cách dùng: gọi printRegistrationCard(reservationId); <RegistrationCardHost/> (gắn 1 lần trong dashboard)
// sẽ dựng phiếu rồi mở hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF" để ra file PDF).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePms } from "@/lib/pms/store";
import { fmtDate, fmtTime, localDateOf, money, splitName } from "@/lib/pms/format";
import { folioOfReservation, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import { countryLabel } from "./guest-form";

const EVENT = "avanti:print-registration";
export function printRegistrationCard(reservationId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: reservationId }));
}

export function RegistrationCardHost() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const onReq = (e: Event) => setId((e as CustomEvent<string>).detail);
    const onAfter = () => setId(null);
    window.addEventListener(EVENT, onReq);
    window.addEventListener("afterprint", onAfter);
    return () => { window.removeEventListener(EVENT, onReq); window.removeEventListener("afterprint", onAfter); };
  }, []);
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => window.print(), 150); // đợi logo tải xong
    return () => clearTimeout(t);
  }, [id]);
  if (!id) return null;
  return createPortal(<div className="print-root"><CardSheet reservationId={id} /></div>, document.body);
}

const Box = ({ on }: { on?: boolean }) => <span className="rc-box">{on ? "X" : ""}</span>;

function CardSheet({ reservationId }: { reservationId: string }) {
  const { state, session } = usePms();
  const r = state.reservations.find(x => x.id === reservationId);
  if (!r) return null;
  const g = guestById(state, r.guestId);
  const room = roomById(state, r.roomId);
  const type = roomTypeById(state, room?.roomTypeId ?? r.roomTypeId);
  const branch = state.branches.find(b => b.id === r.branchId);
  const folio = folioOfReservation(state, r.id);
  const { last, first } = splitName(g?.fullName ?? "");
  const credits = folio ? state.transactions.filter(t => t.folioId === folio.id && !t.voided && t.kind === "credit" && t.paymentMethod) : [];
  const methods = new Set(credits.map(t => t.paymentMethod));
  const cash = methods.has("cash_vnd") || methods.has("cash_usd");
  const other = methods.has("bank_transfer") || methods.has("city_ledger");
  const extraBed = type && r.adults + r.children > type.maxPax ? 1 : 0;
  const now = new Date().toISOString();
  const isMain = branch?.code === "AVANTI";

  return (
    <div className="rc-sheet">
      <header className="rc-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/avanti-logo.png" alt="Avanti Hotel" className="rc-logo" />
        <div className="rc-addr">
          {isMain ? <>
            <div>186 Le Thanh Ton, ST., Ben Thanh, Dist.1, HCM</div>
            <div>T: +84 8 3822 8066 | F: +84 8 3822 8055</div>
            <div className="rc-blue">Email: info@avantihotel.vn | www.avantihotel.vn</div>
          </> : <>
            <div>{branch?.name} — {branch?.address}</div>
            <div className="rc-blue">Email: info@avantihotel.vn | www.avantihotel.vn</div>
          </>}
        </div>
      </header>

      <div className="rc-titlebar">
        <span className="rc-title">Guest Registration Card</span>
        <span className="rc-resno"><span>Reservation Number:</span> <b>{r.confirmationNo}</b></span>
      </div>

      <table className="rc-table">
        <tbody>
          <tr><td className="rc-l">Family/Surname :</td><td className="rc-v">{last}</td><td className="rc-l rc-sep">First/Given name :</td><td className="rc-v">{first}</td></tr>
          <tr><td className="rc-l">Company Name :</td><td className="rc-v" colSpan={3}>{g?.company}</td></tr>
          <tr><td className="rc-l">Date of birth :</td><td className="rc-v">{g?.dob ? fmtDate(g.dob) : ""}</td><td className="rc-l rc-sep">Place of birth :</td><td className="rc-v" /></tr>
          <tr><td className="rc-l">Nationality :</td><td className="rc-v">{g ? countryLabel(g.nationality) : ""}</td><td className="rc-l rc-sep">{g?.idType === "passport" ? "Passport No :" : "ID Card (CCCD) :"}</td><td className="rc-v">{g?.idNumber}</td></tr>
          <tr><td className="rc-l">Address :</td><td className="rc-v" colSpan={3}>{g?.address}</td></tr>
          <tr><td className="rc-l">Email :</td><td className="rc-v">{g?.email}</td>
            <td className="rc-sep" colSpan={2}><span className="rc-opts"><span><Box /> VIP</span><span><Box /> Leisure</span><span><Box /> Business</span></span></td></tr>
          <tr><td className="rc-l">Mobile :</td><td className="rc-v">{g?.phone}</td>
            <td className="rc-sep" colSpan={2}><span className="rc-opts"><span className="rc-l">Purpose:</span><span><Box /> Meeting, Conference</span><span><Box on={r.mealPlan !== "RO"} /> Breakfast</span></span></td></tr>
          <tr><td className="rc-l">Arrival Date :</td><td className="rc-v">{fmtDate(r.arrivalDate)}</td><td className="rc-l rc-sep">Departure Date :</td><td className="rc-v">{fmtDate(r.departureDate)}</td></tr>
          <tr><td className="rc-l">Mode of Payment :</td><td colSpan={3}><span className="rc-opts rc-wide"><span><Box on={cash} /> Cash</span><span><Box /> Visacard</span><span><Box /> Mastercard</span><span><Box /> American Express</span><span><Box on={other} /> Other</span></span></td></tr>
          <tr className="rc-sm"><td className="rc-l">Card Holder :</td><td className="rc-v" colSpan={3} /></tr>
          <tr className="rc-sm rc-solid"><td className="rc-l">Credit Card No :</td><td className="rc-v" /><td className="rc-l rc-right" colSpan={2}>Expiry Date : __/__</td></tr>
          <tr className="rc-solid"><td colSpan={4} className="rc-center rc-bold">Hotel Use:</td></tr>
          <tr className="rc-sm"><td className="rc-l">Room number :</td><td className="rc-v rc-big">{room?.number ?? "—"}</td><td className="rc-l">Room rate: <span className="rc-v">{money(r.rate)} ₫</span></td><td className="rc-l">Room type : <span className="rc-v">{type?.name}</span></td></tr>
          <tr className="rc-sm"><td className="rc-l">Adults :</td><td className="rc-v rc-center">{r.adults}</td><td className="rc-l">Children : <span className="rc-v">{r.children}</span></td><td className="rc-l">Extra Bed : <span className="rc-v">{extraBed}</span></td></tr>
          <tr className="rc-sm"><td className="rc-l">Booked By :</td><td className="rc-v" colSpan={3}>{[r.source, g?.company].filter(Boolean).join(" · ")}</td></tr>
          <tr className="rc-sm rc-solid"><td className="rc-l">Billing instructions :</td><td className="rc-v" colSpan={3}>{r.note}</td></tr>
        </tbody>
      </table>

      <section className="rc-terms">
        <h3>Noted/ Chú ý:</h3>
        <p><b>1. Check- in time at 14:00 and check out time at 12:00 (noon)</b> / Giờ nhận phòng: 14:00 và giờ trả phòng lúc 12:00 trưa</p>
        <p><b>2</b>. <b>Hotel room cleaning times are generally between 9:30 and 15:30</b> / Thời gian vệ sinh phòng khách lưu trú từ 9:30 đến 15:30</p>
        <p><b>3. Special requests are subject to availability upon check-in and may incur additional charges. Special requests can not be guaranteed.</b> / Những yêu cầu đặc biệt có thể thực hiện lúc nhận phòng. Tuy nhiên, sẽ từ chối nếu khách sạn không đáp ứng được. Bên cạnh đó, có thể thu thêm phí.</p>
        <p><b>4. Under Vietnamese law, a guest who is not a Vietnamese citizen can not share a room with a Vietnamese citizen without proof of marriage to each other. Otherwise, a second room must be booked.</b> / Theo luật Việt Nam ban hành, khách không mang quốc tịch Việt Nam không thể chung phòng với công dân Việt Nam nếu không có giấy đăng ký kết hôn. Do đó, phải đặt thêm một phòng thứ hai.</p>
        <p><b>5. Money, jewels and other valuables are brought to the Avanti Hotel premises at the guest&apos;s sole risk. The Avanti Hotel&apos;s management accept no liability and shall not be responsible for any loss or damage there to and guests remain solely responsible for the safekeeping of any such items.</b> / Tiền bạc, đồ trang sức và các vật có giá trị khác, được khách đưa đến khách sạn Avanti, khách phải tự bảo quản và chịu trách nhiệm. Ban quản lý khách sạn không chịu trách nhiệm cho sự mất mát và bất kỳ tổn thất hoặc thiệt hại nào trước pháp luật.</p>
        <p><b>6. I consent to the usage of my personal information for administrative and marketing purposes. The hotel guarantees not to disclose infomation to third parties other and affiliated companies.</b> / Tôi chấp thuận việc sử dụng thông tin cá nhân của tôi cho mục đích quản lý và tiếp thị. Khách sạn bảo đảm rằng không tiết lộ thông tin cho bên thứ ba và các công ty trực thuộc.</p>
      </section>

      <table className="rc-sign">
        <thead><tr><th>Guest Signature</th><th>Check In By</th></tr></thead>
        <tbody><tr><td /><td><span className="rc-staff">{session.staffName}</span></td></tr></tbody>
      </table>
      <div className="rc-foot">In lúc {fmtTime(now)} {fmtDate(localDateOf(now))} · Folio #{folio?.folioNo ?? r.confirmationNo} · Phòng {room?.number ?? "—"}</div>
    </div>
  );
}
