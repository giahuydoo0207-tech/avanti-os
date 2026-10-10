"use client";
// Hồ sơ khách + thông tin lưu trú đầy đủ của một đặt phòng.
// Dùng trong ngăn chi tiết ở Tìm kiếm và trong màn hình Check-out.
import { usePms } from "@/lib/pms/store";
import { ageOn, diffDays, fmtDate, fmtTime, GENDER_LABEL, localDateOf, MEAL_PLAN_LABEL, money, splitName } from "@/lib/pms/format";
import { folioOfReservation, folioTotals, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import { countryLabel } from "./guest-form";
import { ResBadge } from "./ui";

function Item({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-[13px] font-medium text-ink mt-0.5 break-words ${mono ? "mono" : ""}`}>{empty ? <span className="text-faint font-sans">Chưa có</span> : value}</dd>
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4 border-t border-line-soft first:border-t-0 first:pt-0">
      <h3 className="text-[12px] font-semibold text-ink-2 mb-3">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </section>
  );
}

export function GuestStayDetails({ reservationId, compact }: { reservationId: string; compact?: boolean }) {
  const { state, today } = usePms();
  const r = state.reservations.find(x => x.id === reservationId);
  if (!r) return null;
  const g = guestById(state, r.guestId);
  const room = roomById(state, r.roomId);
  const type = roomTypeById(state, room?.roomTypeId ?? r.roomTypeId);
  const folio = folioOfReservation(state, r.id);
  const bal = folio ? folioTotals(state, folio.id).balance : 0;
  const { last, first } = splitName(g?.fullName ?? "");
  const age = ageOn(g?.dob ?? null, today);
  const nights = diffDays(r.arrivalDate, r.departureDate);
  const foreign = g?.guestType === "foreign";

  return (
    <div className={compact ? "" : "grid grid-cols-2 gap-x-10"}>
      <div>
        <Group title="Thông tin khách">
          <Item label="Họ (Last name)" value={last} />
          <Item label="Tên (First name)" value={first} />
          <Item label="Quốc tịch" value={g ? countryLabel(g.nationality) : ""} />
          <Item label="Giới tính" value={g?.gender ? GENDER_LABEL[g.gender] : ""} />
          <Item label="Ngày sinh" value={g?.dob ? `${fmtDate(g.dob)}${age !== null ? ` (${age} tuổi)` : ""}` : ""} mono />
          <Item label="Loại giấy tờ (ID)" value={g ? (g.idType === "cccd" ? "Căn cước công dân (CCCD)" : "Hộ chiếu (Passport)") : ""} />
          <Item label={g?.idType === "passport" ? "Số hộ chiếu" : "Số CCCD"} value={g?.idNumber} mono />
          <Item label="Ngày cấp" value={g?.idIssuedDate ? fmtDate(g.idIssuedDate) : ""} mono />
          <Item label={g?.idType === "passport" ? "Hạn hộ chiếu" : "Nơi cấp"} value={g?.idType === "passport" ? (g.idExpiryDate ? fmtDate(g.idExpiryDate) : "") : g?.idIssuedPlace} mono={g?.idType === "passport"} />
          <Item label="Điện thoại" value={g?.phone} mono />
          <Item label="Email" value={g?.email} />
          <Item label="Công ty / TA" value={g?.company} />
          <Item label="Địa chỉ" value={g?.address} />
        </Group>
        {foreign && (
          <Group title="Khai báo tạm trú (PC06)">
            <Item label="Loại visa" value={g?.visaType} />
            <Item label="Số visa" value={g?.visaNumber} mono />
            <Item label="Hạn visa" value={g?.visaExpiry ? fmtDate(g.visaExpiry) : ""} mono />
            <Item label="Ngày nhập cảnh" value={g?.entryDate ? fmtDate(g.entryDate) : ""} mono />
            <Item label="Cửa khẩu" value={g?.portOfEntry} wide />
          </Group>
        )}
      </div>
      <div>
        <Group title="Lưu trú">
          <Item label="Trạng thái" value={<ResBadge status={r.status} />} />
          <Item label="Số xác nhận" value={`#${r.confirmationNo}`} mono />
          <Item label="Ngày đến" value={fmtDate(r.arrivalDate)} mono />
          <Item label="Ngày đi" value={fmtDate(r.departureDate)} mono />
          <Item label="Số đêm" value={`${nights} đêm`} />
          <Item label="Khách" value={`${r.adults} người lớn${r.children ? `, ${r.children} trẻ em` : ""}`} />
          <Item label="Phòng" value={room ? `${room.number} · ${type?.code}` : `Chưa gán · ${type?.code}`} mono />
          <Item label="Loại phòng" value={type?.name} />
          <Item label="Giá / đêm" value={`${money(r.rate)} ₫`} mono />
          <Item label="Gói ăn" value={MEAL_PLAN_LABEL[r.mealPlan]} />
          <Item label="Nguồn đặt" value={r.source} />
          <Item label="Folio" value={folio ? `#${folio.folioNo}` : ""} mono />
          <Item label="Giờ nhận phòng" value={r.checkedInAt ? `${fmtTime(r.checkedInAt)} ${fmtDate(localDateOf(r.checkedInAt))}` : ""} mono />
          <Item label="Số dư folio" value={<span className={bal > 0 ? "text-dirty" : "text-clean"}>{money(bal)} ₫</span>} mono />
          <Item label="Ghi chú" value={r.note} wide />
        </Group>
      </div>
    </div>
  );
}
