"use client";
// Tab Hồ sơ khách: mở khi bấm một dòng ở Tìm kiếm. Xem đủ thông tin khách + lưu trú,
// sửa hồ sơ ngay tại chỗ và xem lịch sử thay đổi (ai sửa, lúc nào, giá trị cũ → mới).
import { useState } from "react";
import { ArrowLeft, DollarSign, History, LogIn, LogOut, Pencil, Save, X } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import type { GuestInput } from "@/lib/pms/store";
import { ageOn, diffDays, fmtDate, fmtTime, GENDER_LABEL, localDateOf, MEAL_PLAN_LABEL, money, splitName } from "@/lib/pms/format";
import { branchReservations, folioOfReservation, folioTotals, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { Gender, GuestChange, IdType } from "@/lib/pms/types";
import { COUNTRIES, countryLabel, guestToInput } from "../guest-form";
import { Group, Item } from "../guest-profile";
import { useNav } from "../nav";
import { Card, ErrorBox, ResBadge, SectionTitle, inputCls, selectCls } from "../ui";

const FIELD_LABEL: Record<string, string> = {
  fullName: "Họ và tên", full_name: "Họ và tên", nationality: "Quốc tịch", guestType: "Loại khách", guest_type: "Loại khách",
  idType: "Loại giấy tờ", id_type: "Loại giấy tờ", idNumber: "Số giấy tờ", id_number: "Số giấy tờ",
  idIssuedDate: "Ngày cấp", id_issued_date: "Ngày cấp", idIssuedPlace: "Nơi cấp", id_issued_place: "Nơi cấp",
  idExpiryDate: "Hạn hộ chiếu", id_expiry_date: "Hạn hộ chiếu", dob: "Ngày sinh", gender: "Giới tính",
  phone: "Điện thoại", email: "Email", address: "Địa chỉ", company: "Công ty / TA",
  visaType: "Loại visa", visa_type: "Loại visa", visaNumber: "Số visa", visa_number: "Số visa",
  visaExpiry: "Hạn visa", visa_expiry: "Hạn visa", entryDate: "Ngày nhập cảnh", entry_date: "Ngày nhập cảnh", portOfEntry: "Cửa khẩu", port_of_entry: "Cửa khẩu",
};
const camelOf = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
function fmtValue(field: string, v: string | null): string {
  if (v === null || v === "") return "(trống)";
  const f = camelOf(field);
  if (f === "gender") return GENDER_LABEL[v as Gender] ?? v;
  if (f === "idType") return v === "cccd" ? "CCCD" : "Hộ chiếu";
  if (f === "guestType") return v === "vietnamese" ? "Khách Việt Nam" : "Khách nước ngoài";
  if (f === "nationality") return countryLabel(v.trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  return v;
}
const fmtStamp = (iso: string) => `${fmtTime(iso)} · ${fmtDate(localDateOf(iso))}`;

export function GuestProfileTab() {
  const { state, today, actions } = usePms();
  const { intent, goTo, openOverlay, toast } = useNav();
  const back = () => goTo("Tìm kiếm", { search: { restore: true } });
  const r = state.reservations.find(x => x.id === intent.profile?.reservationId);
  const g = r ? guestById(state, r.guestId) : undefined;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<(GuestInput & { last: string; first: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const history = (() => {
    if (!g) return [];
    const list = (state.guestChanges ?? []).filter(c => c.guestId === g.id).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    // Gom các trường được lưu cùng một lần (cùng thời điểm, cùng người sửa)
    const groups: Array<{ key: string; at: string; by: string; items: GuestChange[] }> = [];
    for (const c of list) {
      const key = `${c.changedAt.slice(0, 19)}|${c.changedBy}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(c); else groups.push({ key, at: c.changedAt, by: c.changedBy, items: [c] });
    }
    return groups;
  })();

  if (!r || !g) {
    return (
      <div className="p-7 max-w-7xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-[14px] text-ink-2">Không tìm thấy hồ sơ. Hãy chọn lại khách ở màn hình Tìm kiếm.</p>
          <button onClick={back} className="pms-btn-secondary mt-4"><ArrowLeft size={14} aria-hidden="true" /> Về Tìm kiếm</button>
        </Card>
      </div>
    );
  }

  const room = roomById(state, r.roomId);
  const type = roomTypeById(state, room?.roomTypeId ?? r.roomTypeId);
  const folio = folioOfReservation(state, r.id);
  const bal = folio ? folioTotals(state, folio.id).balance : 0;
  const { last, first } = splitName(g.fullName);
  const age = ageOn(g.dob, today);
  const nights = diffDays(r.arrivalDate, r.departureDate);
  const canCheckIn = r.status === "confirmed" || r.status === "tentative";
  const stays = branchReservations(state, r.branchId).filter(x => x.guestId === g.id).sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const lastChange = history[0];

  const startEdit = () => { setDraft({ ...guestToInput(g), last, first }); setError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setDraft(null); setError(null); };
  const set = <K extends keyof NonNullable<typeof draft>>(k: K, v: NonNullable<typeof draft>[K]) => setDraft(d => (d ? { ...d, [k]: v } : d));
  const save = async () => {
    if (!draft) return;
    const lastName = draft.last.trim(); const firstName = draft.first.trim();
    if (!lastName) return setError("Họ (Last name) không được để trống");
    if (draft.idType === "cccd" && draft.idNumber && draft.idNumber.length !== 12) return setError("Số CCCD phải gồm đúng 12 chữ số");
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) return setError("Email không hợp lệ");
    const { last: _l, first: _f, ...rest } = draft; void _l; void _f;
    setSaving(true);
    const res = await actions.updateGuest(g.id, { ...rest, fullName: `${lastName} ${firstName}`.trim() });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setEditing(false); setDraft(null); toast("Đã lưu hồ sơ khách");
  };

  const lbl = "text-[12px] font-medium text-ink-2";
  const d = (v: string) => (v ? v : null);

  return (
    <div className="p-7 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button onClick={back} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink mb-2"><ArrowLeft size={14} aria-hidden="true" /> Kết quả tìm kiếm</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">{g.fullName}</h2>
            <ResBadge status={r.status} />
          </div>
          <div className="text-[13px] text-muted mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="mono">#{r.confirmationNo}</span><span aria-hidden="true">·</span>
            <span>{room ? <>Phòng <span className="mono font-semibold text-ink-2">{room.number}</span></> : "Chưa gán phòng"} · {type?.code}</span><span aria-hidden="true">·</span>
            <span className="mono">{fmtDate(r.arrivalDate)} → {fmtDate(r.departureDate)}</span><span aria-hidden="true">·</span>
            <span>{countryLabel(g.nationality)}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editing && <button onClick={startEdit} className="pms-btn-secondary"><Pencil size={14} aria-hidden="true" /> Sửa hồ sơ</button>}
          <button onClick={() => openOverlay({ kind: "folio", reservationId: r.id })} className="pms-btn-secondary"><DollarSign size={14} aria-hidden="true" /> Folio</button>
          {canCheckIn && <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} className="pms-btn-primary"><LogIn size={14} aria-hidden="true" /> Check-in</button>}
          {r.status === "checked_in" && <button onClick={() => openOverlay({ kind: "checkout", reservationId: r.id })} className="pms-btn-danger"><LogOut size={14} aria-hidden="true" /> Check-out</button>}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 xl:col-span-8 space-y-4">
          <Card className={`p-6 ${editing ? "border-accent/50" : ""}`}>
            <div className="flex items-center justify-between">
              <SectionTitle>Thông tin khách</SectionTitle>
              {editing && <span className="text-[12px] font-medium text-accent-strong -mt-4">Đang chỉnh sửa</span>}
            </div>
            {!editing || !draft ? (
              <Group title="" cols={3}>
                <Item label="Họ (Last name)" value={last} />
                <Item label="Tên (First name)" value={first} />
                <Item label="Quốc tịch" value={countryLabel(g.nationality)} />
                <Item label="Giới tính" value={g.gender ? GENDER_LABEL[g.gender] : ""} />
                <Item label="Ngày sinh" value={g.dob ? `${fmtDate(g.dob)}${age !== null ? ` (${age} tuổi)` : ""}` : ""} mono />
                <Item label="Loại giấy tờ (ID)" value={g.idType === "cccd" ? "Căn cước công dân (CCCD)" : "Hộ chiếu (Passport)"} />
                <Item label={g.idType === "passport" ? "Số hộ chiếu" : "Số CCCD"} value={g.idNumber} mono />
                <Item label="Ngày cấp" value={g.idIssuedDate ? fmtDate(g.idIssuedDate) : ""} mono />
                {g.idType === "passport"
                  ? <Item label="Hạn hộ chiếu" value={g.idExpiryDate ? fmtDate(g.idExpiryDate) : ""} mono />
                  : <Item label="Nơi cấp" value={g.idIssuedPlace} />}
                <Item label="Điện thoại" value={g.phone} mono />
                <Item label="Email" value={g.email} />
                <Item label="Công ty / TA" value={g.company} />
                <Item label="Địa chỉ" value={g.address} wide />
              </Group>
            ) : (
              <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
                <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                  <label className="space-y-1"><span className={lbl}>Họ (Last name) <span className="text-dirty" aria-hidden="true">*</span></span>
                    <input className={inputCls} value={draft.last} onChange={e => set("last", e.target.value.toUpperCase())} autoFocus /></label>
                  <label className="space-y-1"><span className={lbl}>Tên (First name)</span>
                    <input className={inputCls} value={draft.first} onChange={e => set("first", e.target.value.toUpperCase())} /></label>
                  <label className="space-y-1"><span className={lbl}>Quốc tịch</span>
                    <select className={selectCls} value={draft.nationality} onChange={e => { const v = e.target.value; setDraft(x => (x ? { ...x, nationality: v, guestType: v === "VN" ? "vietnamese" : "foreign" } : x)); }}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                  <label className="space-y-1"><span className={lbl}>Giới tính</span>
                    <select className={selectCls} value={draft.gender ?? ""} onChange={e => set("gender", (e.target.value || null) as Gender | null)}><option value="">—</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
                  <label className="space-y-1"><span className={lbl}>Ngày sinh</span>
                    <input type="date" className={`${inputCls} mono`} value={draft.dob ?? ""} onChange={e => set("dob", d(e.target.value))} /></label>
                  <label className="space-y-1"><span className={lbl}>Loại giấy tờ (ID)</span>
                    <select className={selectCls} value={draft.idType} onChange={e => set("idType", e.target.value as IdType)}><option value="cccd">Căn cước công dân (CCCD)</option><option value="passport">Hộ chiếu (Passport)</option></select></label>
                  <label className="space-y-1"><span className={lbl}>{draft.idType === "cccd" ? "Số CCCD (12 số)" : "Số hộ chiếu"}</span>
                    <input className={`${inputCls} mono`} value={draft.idNumber} spellCheck={false} inputMode={draft.idType === "cccd" ? "numeric" : "text"}
                      onChange={e => set("idNumber", draft.idType === "cccd" ? e.target.value.replace(/\D/g, "").slice(0, 12) : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} /></label>
                  <label className="space-y-1"><span className={lbl}>Ngày cấp</span>
                    <input type="date" className={`${inputCls} mono`} value={draft.idIssuedDate ?? ""} onChange={e => set("idIssuedDate", d(e.target.value))} /></label>
                  {draft.idType === "passport"
                    ? <label className="space-y-1"><span className={lbl}>Hạn hộ chiếu</span>
                        <input type="date" className={`${inputCls} mono`} value={draft.idExpiryDate ?? ""} onChange={e => set("idExpiryDate", d(e.target.value))} /></label>
                    : <label className="space-y-1"><span className={lbl}>Nơi cấp</span>
                        <input className={inputCls} value={draft.idIssuedPlace} onChange={e => set("idIssuedPlace", e.target.value)} placeholder="Cục CS QLHC về TTXH" /></label>}
                  <label className="space-y-1"><span className={lbl}>Điện thoại</span>
                    <input className={`${inputCls} mono`} value={draft.phone} onChange={e => set("phone", e.target.value)} inputMode="tel" /></label>
                  <label className="space-y-1"><span className={lbl}>Email</span>
                    <input type="email" className={inputCls} value={draft.email} onChange={e => set("email", e.target.value)} /></label>
                  <label className="space-y-1"><span className={lbl}>Công ty / TA</span>
                    <input className={inputCls} value={draft.company} onChange={e => set("company", e.target.value)} /></label>
                  <label className="space-y-1 col-span-3"><span className={lbl}>Địa chỉ</span>
                    <input className={inputCls} value={draft.address} onChange={e => set("address", e.target.value)} /></label>
                </div>
                <ErrorBox message={error} />
                <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                  <button type="button" onClick={cancel} className="pms-btn-secondary"><X size={14} aria-hidden="true" /> Hủy</button>
                  <button type="submit" disabled={saving} className="pms-btn-primary"><Save size={14} aria-hidden="true" /> {saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
                </div>
              </form>
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle>Lưu trú</SectionTitle>
            <Group title="" cols={3}>
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
              <Item label="Số dư folio" value={<span className={bal > 0 ? "text-dirty" : "text-clean"}>{money(bal)} ₫</span>} mono />
              <Item label="Giờ nhận phòng" value={r.checkedInAt ? fmtStamp(r.checkedInAt) : ""} mono />
              <Item label="Giờ trả phòng" value={r.checkedOutAt ? fmtStamp(r.checkedOutAt) : ""} mono />
              <Item label="Người tạo đặt phòng" value={r.createdBy} />
              <Item label="Ghi chú" value={r.note} wide />
            </Group>
          </Card>

          {stays.length > 1 && (
            <Card className="overflow-hidden">
              <div className="px-6 pt-5"><SectionTitle>Các lần lưu trú ({stays.length})</SectionTitle></div>
              <table className="w-full text-left">
                <thead><tr className="border-y border-line bg-sunken text-[11px] font-semibold text-ink-2">
                  <th scope="col" className="px-6 py-2">Xác nhận</th><th scope="col" className="px-3 py-2">Đến</th><th scope="col" className="px-3 py-2">Đi</th><th scope="col" className="px-3 py-2">Phòng</th><th scope="col" className="px-3 py-2">Trạng thái</th>
                </tr></thead>
                <tbody>
                  {stays.map(x => (
                    <tr key={x.id} onClick={() => x.id !== r.id && goTo("Hồ sơ khách", { profile: { reservationId: x.id } })}
                      className={`border-b border-line-soft last:border-b-0 text-[12px] ${x.id === r.id ? "bg-accent-soft" : "cursor-pointer hover:bg-sunken"}`}>
                      <td className="px-6 py-2 mono">#{x.confirmationNo}</td><td className="px-3 py-2 mono">{fmtDate(x.arrivalDate)}</td><td className="px-3 py-2 mono">{fmtDate(x.departureDate)}</td>
                      <td className="px-3 py-2 mono">{roomById(state, x.roomId)?.number ?? "—"}</td><td className="px-3 py-2"><ResBadge status={x.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card className="col-span-12 xl:col-span-4 p-5 xl:sticky xl:top-[72px]">
          <SectionTitle><span className="inline-flex items-center gap-1.5"><History size={14} aria-hidden="true" /> Lịch sử thay đổi hồ sơ</span></SectionTitle>
          <div className="grid grid-cols-2 gap-3 pb-4 mb-4 border-b border-line-soft">
            <div><div className="text-[11px] text-muted">Tạo hồ sơ</div><div className="mono text-[12px] font-semibold text-ink mt-0.5">{fmtStamp(g.createdAt)}</div></div>
            <div><div className="text-[11px] text-muted">Cập nhật lần cuối</div><div className="mono text-[12px] font-semibold text-ink mt-0.5">{lastChange ? fmtStamp(lastChange.at) : "Chưa sửa lần nào"}</div></div>
          </div>
          <ol className="relative space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {history.map(h => (
              <li key={h.key} className="relative pl-5">
                <span aria-hidden="true" className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-accent" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-[12px] font-semibold text-ink">{fmtStamp(h.at)}</span>
                  <span className="text-[11px] text-muted truncate">{h.by}</span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {h.items.map(c => (
                    <li key={c.id} className="text-[12px] leading-snug">
                      <span className="font-medium text-ink-2">{FIELD_LABEL[c.field] ?? c.field}:</span>{" "}
                      <span className="text-muted line-through decoration-faint">{fmtValue(c.field, c.oldValue)}</span>
                      <span className="text-faint" aria-label="đổi thành"> → </span>
                      <span className="text-ink font-medium">{fmtValue(c.field, c.newValue)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            <li className="relative pl-5">
              <span aria-hidden="true" className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-line-strong" />
              <span className="mono text-[12px] font-semibold text-ink">{fmtStamp(g.createdAt)}</span>
              <p className="text-[12px] text-muted mt-1">Tạo hồ sơ khách</p>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
