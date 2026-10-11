"use client";
// Tab Hồ sơ khách: mở khi bấm một dòng ở Tìm kiếm. Xem và sửa luôn trên cùng một màn hình
// (thông tin khách + loại phòng/số phòng), một nút Lưu cho tất cả, kèm lịch sử thay đổi.
import { useState } from "react";
import { ArrowLeft, ArrowUpDown, DollarSign, History, LogIn, LogOut, Printer, RotateCcw, Save } from "lucide-react";
import { printRegistrationCard } from "../registration-card";
import { usePms } from "@/lib/pms/store";
import type { GuestInput } from "@/lib/pms/store";
import { ageOn, diffDays, fmtDate, fmtTime, GENDER_LABEL, localDateOf, MEAL_PLAN_LABEL, money, splitName } from "@/lib/pms/format";
import { branchReservations, extraBedOf, folioOfReservation, folioTotals, guestById, roomById, roomConflict, roomTypeById } from "@/lib/pms/selectors";
import type { BookingSource, Gender, IdType, MealPlan } from "@/lib/pms/types";
import { COUNTRIES, countryLabel, guestToInput } from "../guest-form";
import { Group, Item } from "../guest-profile";
import { useNav } from "../nav";
import { Card, ErrorBox, ResBadge, SectionTitle, inputCls, selectCls } from "../ui";

const FIELD_LABEL: Record<string, string> = {
  fullName: "Họ và tên", nationality: "Quốc tịch", guestType: "Loại khách", idType: "Loại giấy tờ", idNumber: "Số giấy tờ",
  idIssuedDate: "Ngày cấp", idIssuedPlace: "Nơi cấp", idExpiryDate: "Hạn hộ chiếu", dob: "Ngày sinh", gender: "Giới tính",
  phone: "Điện thoại", email: "Email", address: "Địa chỉ", company: "Công ty / TA",
  visaType: "Loại visa", visaNumber: "Số visa", visaExpiry: "Hạn visa", entryDate: "Ngày nhập cảnh", portOfEntry: "Cửa khẩu",
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
const STAY_ACTIONS = new Set(["reservation.update", "reservation.update_stay", "reservation.assign_room", "reservation.move"]);
const GUEST_KEYS = ["last", "first", "nationality", "guestType", "gender", "dob", "idType", "idNumber", "idIssuedDate", "idIssuedPlace", "idExpiryDate", "phone", "email", "company", "address"] as const;

type Draft = GuestInput & {
  last: string; first: string; roomTypeId: string; roomId: string;
  arrivalDate: string; departureDate: string; adults: number; children: number; extraBed: number; rate: number; mealPlan: MealPlan; source: BookingSource; note: string;
};
const STAY_KEYS = ["roomTypeId", "roomId", "arrivalDate", "departureDate", "adults", "children", "extraBed", "rate", "mealPlan", "source", "note"] as const;
const SOURCES: BookingSource[] = ["Direct", "Walk-in", "Booking.com", "Agoda", "Expedia", "Traveloka", "Travel Agent"];
const MEALS: MealPlan[] = ["RO", "BB", "HB", "FB"];
type HistoryEntry = { key: string; at: string; by: string; lines: React.ReactNode[] };

export function GuestProfileTab() {
  const { state, today, actions } = usePms();
  const { intent, goTo, openOverlay, toast } = useNav();
  const r = state.reservations.find(x => x.id === intent.profile?.reservationId);
  const g = r ? guestById(state, r.guestId) : undefined;

  // draft = null nghĩa là chưa sửa gì, form hiển thị đúng dữ liệu hiện tại
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!r || !g) {
    return (
      <div className="p-7 max-w-7xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-[14px] text-ink-2">Không tìm thấy hồ sơ. Hãy chọn lại khách ở màn hình Tìm kiếm.</p>
          <button onClick={() => goTo("Tìm kiếm", { search: { restore: true } })} className="pms-btn-secondary mt-4"><ArrowLeft size={14} aria-hidden="true" /> Về Tìm kiếm</button>
        </Card>
      </div>
    );
  }

  const { last, first } = splitName(g.fullName);
  const base: Draft = {
    ...guestToInput(g), last, first, roomTypeId: r.roomTypeId, roomId: r.roomId ?? "",
    arrivalDate: r.arrivalDate, departureDate: r.departureDate, adults: r.adults, children: r.children, extraBed: extraBedOf(state, r), rate: r.rate, mealPlan: r.mealPlan, source: r.source, note: r.note ?? "",
  };
  const form = draft ?? base;
  const guestDirty = GUEST_KEYS.some(k => (form[k] ?? "") !== (base[k] ?? ""));
  const stayDirty = STAY_KEYS.some(k => form[k] !== base[k]);
  const dirty = guestDirty || stayDirty;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setError(null); setDraft(d => ({ ...(d ?? base), [k]: v })); };
  const reset = () => { setDraft(null); setError(null); };
  const back = () => { if (dirty && !window.confirm("Bỏ các thay đổi chưa lưu?")) return; goTo("Tìm kiếm", { search: { restore: true } }); };

  const editableStay = r.status === "confirmed" || r.status === "tentative" || r.status === "checked_in";
  const types = state.roomTypes.filter(t => t.branchId === r.branchId);
  const roomOptions = state.rooms
    .filter(x => x.branchId === r.branchId && x.roomTypeId === form.roomTypeId)
    .filter(x => (x.id === r.roomId && form.arrivalDate === r.arrivalDate && form.departureDate === r.departureDate) || (x.hkStatus !== "out_of_order" && !roomConflict(state, x.id, form.arrivalDate, form.departureDate, r.id) && !(r.status === "checked_in" && x.id !== r.roomId && x.hkStatus === "dirty")))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  const save = async () => {
    const lastName = form.last.trim(); const firstName = form.first.trim();
    if (!lastName) return setError("Họ (Last name) không được để trống");
    if (form.idType === "cccd" && form.idNumber && form.idNumber.length !== 12) return setError("Số CCCD phải gồm đúng 12 chữ số");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError("Email không hợp lệ");
    if (r.status === "checked_in" && !form.roomId) return setError("Khách đang ở phải có phòng");
    setSaving(true);
    if (guestDirty) {
      const guest = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "last" && k !== "first" && !(STAY_KEYS as readonly string[]).includes(k))) as GuestInput;
      const res = await actions.updateGuest(g.id, { ...guest, fullName: `${lastName} ${firstName}`.trim() });
      if (!res.ok) { setSaving(false); return setError(res.error); }
    }
    if (stayDirty) {
      const res = await actions.updateReservation(r.id, {
        roomTypeId: form.roomTypeId, roomId: form.roomId || null, arrivalDate: form.arrivalDate, departureDate: form.departureDate,
        adults: Number(form.adults) || 0, children: Number(form.children) || 0, extraBed: Number(form.extraBed) || 0, rate: Number(form.rate) || 0, mealPlan: form.mealPlan, source: form.source, note: form.note,
      });
      if (!res.ok) { setSaving(false); return setError(res.error); }
    }
    setSaving(false); setDraft(null); toast("Đã lưu thay đổi");
  };

  // Lịch sử: các lần sửa hồ sơ (gom theo lần lưu) + các lần đổi phòng của đặt phòng này
  const entries: HistoryEntry[] = [];
  for (const c of (state.guestChanges ?? []).filter(c => c.guestId === g.id).sort((a, b) => b.changedAt.localeCompare(a.changedAt))) {
    const key = `g|${c.changedAt.slice(0, 19)}|${c.changedBy}`;
    const line = (
      <span key={c.id}>
        <span className="font-medium text-ink-2">{FIELD_LABEL[camelOf(c.field)] ?? c.field}:</span>{" "}
        <span className="text-muted line-through decoration-faint">{fmtValue(c.field, c.oldValue)}</span>
        <span className="text-faint" aria-label="đổi thành"> → </span>
        <span className="text-ink font-medium">{fmtValue(c.field, c.newValue)}</span>
      </span>
    );
    const prev = entries[entries.length - 1];
    if (prev && prev.key === key) prev.lines.push(line); else entries.push({ key, at: c.changedAt, by: c.changedBy, lines: [line] });
  }
  for (const a of state.activities.filter(a => a.entityId === r.id && STAY_ACTIONS.has(a.action)))
    entries.push({ key: `a|${a.id}`, at: a.createdAt, by: a.actorName, lines: [<span key={a.id} className="text-ink">{a.message}</span>] });
  entries.sort((a, b) => b.at.localeCompare(a.at));

  const room = roomById(state, r.roomId);
  const type = roomTypeById(state, r.roomTypeId);
  const folio = folioOfReservation(state, r.id);
  const bal = folio ? folioTotals(state, folio.id).balance : 0;
  const age = ageOn(form.dob, today);
  const nights = diffDays(form.arrivalDate, form.departureDate);
  const canCheckIn = r.status === "confirmed" || r.status === "tentative";
  const stays = branchReservations(state, r.branchId).filter(x => x.guestId === g.id).sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const newType = roomTypeById(state, form.roomTypeId);
  const newRoom = roomById(state, form.roomId || null);
  const typeChanged = form.roomTypeId !== r.roomTypeId; const roomChanged = (form.roomId || null) !== r.roomId;
  const stayMoved = typeChanged || roomChanged;
  const upgrade = typeChanged && (newType?.baseRate ?? 0) > (type?.baseRate ?? 0);
  const moveLabel = !stayMoved ? "Upgrade / đổi phòng: chọn bên dưới"
    : `${typeChanged ? `${upgrade ? "Upgrade" : "Đổi loại"} ${type?.code} → ${newType?.code}` : ""}${typeChanged && roomChanged ? " · " : ""}${roomChanged ? `Phòng ${room?.number ?? "chưa gán"} → ${newRoom?.number ?? "chưa gán"}` : ""}`;
  const lbl = "text-[12px] font-medium text-ink-2";
  const d = (v: string) => (v ? v : null);
  const changed = (k: keyof Draft) => ((form[k] ?? "") !== (base[k] ?? "") ? "!border-accent !bg-accent-soft/40" : "");

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
          <button onClick={() => openOverlay({ kind: "folio", reservationId: r.id })} className="pms-btn-secondary"><DollarSign size={14} aria-hidden="true" /> Folio</button>
          {canCheckIn && <button onClick={() => openOverlay({ kind: "checkin", reservationId: r.id })} disabled={dirty} title={dirty ? "Lưu thay đổi trước khi check-in" : undefined} className="pms-btn-primary disabled:opacity-40"><LogIn size={14} aria-hidden="true" /> Check-in</button>}
          {r.status === "checked_in" && <button onClick={() => openOverlay({ kind: "checkout", reservationId: r.id })} disabled={dirty} title={dirty ? "Lưu thay đổi trước khi check-out" : undefined} className="pms-btn-danger disabled:opacity-40"><LogOut size={14} aria-hidden="true" /> Check-out</button>}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <form className="col-span-12 xl:col-span-8 space-y-4" onSubmit={e => { e.preventDefault(); if (dirty) void save(); }}>
          <Card className="p-6">
            <SectionTitle>Thông tin khách</SectionTitle>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              <label className="space-y-1"><span className={lbl}>Họ (Last name) <span className="text-dirty" aria-hidden="true">*</span></span>
                <input className={`${inputCls} ${changed("last")}`} value={form.last} onChange={e => set("last", e.target.value.toUpperCase())} /></label>
              <label className="space-y-1"><span className={lbl}>Tên (First name)</span>
                <input className={`${inputCls} ${changed("first")}`} value={form.first} onChange={e => set("first", e.target.value.toUpperCase())} /></label>
              <label className="space-y-1"><span className={lbl}>Quốc tịch</span>
                <select className={`${selectCls} ${changed("nationality")}`} value={form.nationality} onChange={e => { const v = e.target.value; setError(null); setDraft(x => ({ ...(x ?? base), nationality: v, guestType: v === "VN" ? "vietnamese" : "foreign" })); }}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
              <label className="space-y-1"><span className={lbl}>Giới tính</span>
                <select className={`${selectCls} ${changed("gender")}`} value={form.gender ?? ""} onChange={e => set("gender", (e.target.value || null) as Gender | null)}><option value="">Chưa có</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
              <label className="space-y-1"><span className={lbl}>Ngày sinh{age !== null ? <span className="text-muted font-normal"> · {age} tuổi</span> : null}</span>
                <input type="date" className={`${inputCls} mono ${changed("dob")}`} value={form.dob ?? ""} onChange={e => set("dob", d(e.target.value))} /></label>
              <label className="space-y-1"><span className={lbl}>Loại giấy tờ (ID)</span>
                <select className={`${selectCls} ${changed("idType")}`} value={form.idType} onChange={e => set("idType", e.target.value as IdType)}><option value="cccd">Căn cước công dân (CCCD)</option><option value="passport">Hộ chiếu (Passport)</option></select></label>
              <label className="space-y-1"><span className={lbl}>{form.idType === "cccd" ? "Số CCCD (12 số)" : "Số hộ chiếu"}</span>
                <input className={`${inputCls} mono ${changed("idNumber")}`} value={form.idNumber} spellCheck={false} inputMode={form.idType === "cccd" ? "numeric" : "text"} placeholder="Chưa có"
                  onChange={e => set("idNumber", form.idType === "cccd" ? e.target.value.replace(/\D/g, "").slice(0, 12) : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} /></label>
              <label className="space-y-1"><span className={lbl}>Ngày cấp</span>
                <input type="date" className={`${inputCls} mono ${changed("idIssuedDate")}`} value={form.idIssuedDate ?? ""} onChange={e => set("idIssuedDate", d(e.target.value))} /></label>
              {form.idType === "passport"
                ? <label className="space-y-1"><span className={lbl}>Hạn hộ chiếu</span>
                    <input type="date" className={`${inputCls} mono ${changed("idExpiryDate")}`} value={form.idExpiryDate ?? ""} onChange={e => set("idExpiryDate", d(e.target.value))} /></label>
                : <label className="space-y-1"><span className={lbl}>Nơi cấp</span>
                    <input className={`${inputCls} ${changed("idIssuedPlace")}`} value={form.idIssuedPlace} onChange={e => set("idIssuedPlace", e.target.value)} placeholder="Cục CS QLHC về TTXH" /></label>}
              <label className="space-y-1"><span className={lbl}>Điện thoại</span>
                <input className={`${inputCls} mono ${changed("phone")}`} value={form.phone} onChange={e => set("phone", e.target.value)} inputMode="tel" placeholder="Chưa có" /></label>
              <label className="space-y-1"><span className={lbl}>Email</span>
                <input type="email" className={`${inputCls} ${changed("email")}`} value={form.email} onChange={e => set("email", e.target.value)} placeholder="Chưa có" /></label>
              <label className="space-y-1"><span className={lbl}>Công ty / TA</span>
                <input className={`${inputCls} ${changed("company")}`} value={form.company} onChange={e => set("company", e.target.value)} placeholder="Chưa có" /></label>
              <label className="space-y-1 col-span-3"><span className={lbl}>Địa chỉ</span>
                <input className={`${inputCls} ${changed("address")}`} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Chưa có" /></label>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>Lưu trú</SectionTitle>
              <button type="button" onClick={() => printRegistrationCard(r.id)} className="pms-btn-secondary -mt-4"><Printer size={14} aria-hidden="true" /> In phiếu đăng ký</button>
            </div>

            {/* Phòng hiện tại ⇅ Đổi sang: upgrade loại phòng, đổi phòng, hoặc cả hai */}
            <div className="rounded-ctl border border-line bg-sunken/60 p-4">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1 items-end">
                <div className="space-y-1"><span className={lbl}>Loại phòng hiện tại</span>
                  <div className="h-[38px] px-3 flex items-center rounded-ctl border border-line bg-surface text-[13px] font-medium text-ink truncate">{type ? `${type.code} · ${type.name}` : "—"}</div></div>
                <div className="space-y-1"><span className={lbl}>Số phòng hiện tại</span>
                  <div className="h-[38px] px-3 flex items-center rounded-ctl border border-line bg-surface mono text-[13px] font-semibold text-ink">{room?.number ?? "Chưa gán"}</div></div>
                <div className="w-[120px]" />
              </div>
              <div className="flex items-center gap-3 my-2.5" aria-hidden="true">
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center ${stayMoved ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-muted"}`}><ArrowUpDown size={15} /></span>
                <span className="text-[12px] font-medium text-muted">{moveLabel}</span>
                <span className="flex-1 border-t border-dashed border-line" />
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1 items-end">
                <label className="space-y-1"><span className={lbl}>Đổi sang loại phòng</span>
                  <select className={`${selectCls} ${changed("roomTypeId")}`} disabled={!editableStay} value={form.roomTypeId}
                    onChange={e => { const v = e.target.value; setError(null); setDraft(x => { const cur = x ?? base; const keep = state.rooms.find(rm => rm.id === cur.roomId)?.roomTypeId === v; return { ...cur, roomTypeId: v, roomId: keep ? cur.roomId : v === r.roomTypeId ? (r.roomId ?? "") : "" }; }); }}>
                    {types.map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}{t.id === r.roomTypeId ? " (giữ nguyên)" : ""}</option>)}</select></label>
                <label className="space-y-1"><span className={lbl}>Đổi sang số phòng</span>
                  <select className={`${selectCls} mono ${changed("roomId")}`} disabled={!editableStay} value={form.roomId} onChange={e => set("roomId", e.target.value)}>
                    {(r.status !== "checked_in" || !form.roomId) && <option value="">{r.status === "checked_in" ? "Chọn phòng…" : "Chưa gán"}</option>}
                    {roomOptions.map(x => <option key={x.id} value={x.id}>{x.number}{x.id === r.roomId ? " (giữ nguyên)" : x.hkStatus === "dirty" ? " · chờ dọn" : ""}</option>)}
                    {form.roomId && !roomOptions.some(x => x.id === form.roomId) && <option value={form.roomId}>{newRoom?.number} · không trống các ngày đã chọn</option>}
                  </select></label>
                <p className="w-[120px] text-[11px] text-muted leading-snug pb-1">{!editableStay ? "Đặt phòng đã kết thúc." : `${roomOptions.length} phòng trống đúng loại`}</p>
              </div>
              {r.status === "checked_in" && <p className="text-[11px] text-muted mt-2">Khách đang ở: phòng cũ tự chuyển sang chờ dọn sau khi đổi.</p>}
            </div>

            <div className="grid grid-cols-3 gap-x-4 gap-y-3 mt-5">
              <label className="space-y-1"><span className={lbl}>Ngày đến</span>
                <input type="date" className={`${inputCls} mono ${changed("arrivalDate")}`} disabled={!editableStay || r.status === "checked_in"} value={form.arrivalDate} onChange={e => e.target.value && set("arrivalDate", e.target.value)} /></label>
              <label className="space-y-1"><span className={lbl}>Ngày đi</span>
                <input type="date" className={`${inputCls} mono ${changed("departureDate")}`} disabled={!editableStay} min={form.arrivalDate} value={form.departureDate} onChange={e => e.target.value && set("departureDate", e.target.value)} /></label>
              <div className="space-y-1"><span className={lbl}>Số đêm</span>
                <div className="h-[38px] px-3 flex items-center text-[13px] font-semibold text-ink">{nights > 0 ? `${nights} đêm` : "—"}</div></div>
              <label className="space-y-1"><span className={lbl}>Giá / đêm (₫)</span>
                <input inputMode="numeric" className={`${inputCls} mono ${changed("rate")}`} disabled={!editableStay} value={form.rate ? money(form.rate) : ""} onChange={e => set("rate", Number(e.target.value.replace(/\D/g, "")))} /></label>
              <div className="space-y-1"><span className={lbl}>Số dư folio</span>
                <div className={`h-[38px] px-3 flex items-center rounded-ctl border border-line-soft bg-sunken/50 mono text-[13px] font-semibold ${bal > 0 ? "text-dirty" : "text-clean"}`}>{money(bal)} ₫</div></div>
              <div className="space-y-1"><span className={lbl}>Tiền phòng cả kỳ (chưa VAT)</span>
                <div className="h-[38px] px-3 flex items-center mono text-[13px] font-semibold text-ink-2">{nights > 0 && form.rate ? `${money(nights * form.rate)} ₫` : "—"}</div></div>
              <label className="space-y-1"><span className={lbl}>Người lớn (Adults)</span>
                <input type="number" min={1} className={`${inputCls} mono ${changed("adults")}`} disabled={!editableStay} value={form.adults} onChange={e => set("adults", Number(e.target.value))} /></label>
              <label className="space-y-1"><span className={lbl}>Trẻ em (Children)</span>
                <input type="number" min={0} className={`${inputCls} mono ${changed("children")}`} disabled={!editableStay} value={form.children} onChange={e => set("children", Number(e.target.value))} /></label>
              <label className="space-y-1"><span className={lbl}>Giường phụ (Extra bed)</span>
                <input type="number" min={0} max={2} className={`${inputCls} mono ${changed("extraBed")}`} disabled={!editableStay} value={form.extraBed} onChange={e => set("extraBed", Math.max(0, Math.min(2, Number(e.target.value) || 0)))} /></label>
              <label className="space-y-1"><span className={lbl}>Gói ăn</span>
                <select className={`${selectCls} ${changed("mealPlan")}`} disabled={!editableStay} value={form.mealPlan} onChange={e => set("mealPlan", e.target.value as MealPlan)}>{MEALS.map(m => <option key={m} value={m}>{MEAL_PLAN_LABEL[m]}</option>)}</select></label>
              <label className="space-y-1"><span className={lbl}>Nguồn đặt</span>
                <select className={`${selectCls} ${changed("source")}`} disabled={!editableStay} value={form.source} onChange={e => set("source", e.target.value as BookingSource)}>{SOURCES.map(x => <option key={x}>{x}</option>)}</select></label>
              <div aria-hidden="true" />
              <label className="space-y-1 col-span-3"><span className={lbl}>Ghi chú / yêu cầu đặc biệt</span>
                <input className={`${inputCls} ${changed("note")}`} disabled={!editableStay} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Chưa có" /></label>
            </div>
            {r.status === "checked_in" && (form.rate !== base.rate || form.departureDate !== base.departureDate) && (
              <p className="text-[12px] text-occ-ink bg-occ-soft border border-occ-line rounded-ctl px-3 py-2 mt-3">Khách đang ở: khi lưu, tiền phòng trên folio được điều chỉnh theo ngày đi / giá mới (void đêm bỏ, post thêm đêm mới).</p>
            )}

            <Group title="" cols={3}>
              <Item label="Số đặt phòng / Folio" value={`#${r.confirmationNo}`} mono />
              <Item label="Giờ nhận phòng" value={r.checkedInAt ? fmtStamp(r.checkedInAt) : ""} mono />
              <Item label="Giờ trả phòng" value={r.checkedOutAt ? fmtStamp(r.checkedOutAt) : ""} mono />
              <Item label="Người tạo đặt phòng" value={r.createdBy} />
            </Group>
          </Card>

          {(dirty || error) && (
            <div className="sticky bottom-4 z-10 flex items-center gap-3 flex-wrap bg-surface border border-accent/60 rounded-card px-5 py-3">
              <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
              <div className="text-[13px] font-medium text-ink flex-1 min-w-[200px]">{error ? <ErrorBox message={error} /> : "Có thay đổi chưa lưu"}</div>
              <button type="button" onClick={reset} className="pms-btn-secondary"><RotateCcw size={14} aria-hidden="true" /> Hoàn tác</button>
              <button type="submit" disabled={saving || !dirty} className="pms-btn-primary"><Save size={14} aria-hidden="true" /> {saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
            </div>
          )}

          {stays.length > 1 && (
            <Card className="overflow-hidden">
              <div className="px-6 pt-5"><SectionTitle>Các lần lưu trú ({stays.length})</SectionTitle></div>
              <table className="w-full text-left">
                <thead><tr className="border-y border-line bg-sunken text-[11px] font-semibold text-ink-2">
                  <th scope="col" className="px-6 py-2">Số ĐP / Folio</th><th scope="col" className="px-3 py-2">Đến</th><th scope="col" className="px-3 py-2">Đi</th><th scope="col" className="px-3 py-2">Phòng</th><th scope="col" className="px-3 py-2">Trạng thái</th>
                </tr></thead>
                <tbody>
                  {stays.map(x => (
                    <tr key={x.id} onClick={() => { if (x.id !== r.id && (!dirty || window.confirm("Bỏ các thay đổi chưa lưu?"))) goTo("Hồ sơ khách", { profile: { reservationId: x.id } }); }}
                      className={`border-b border-line-soft last:border-b-0 text-[12px] ${x.id === r.id ? "bg-accent-soft" : "cursor-pointer hover:bg-sunken"}`}>
                      <td className="px-6 py-2 mono">#{x.confirmationNo}</td><td className="px-3 py-2 mono">{fmtDate(x.arrivalDate)}</td><td className="px-3 py-2 mono">{fmtDate(x.departureDate)}</td>
                      <td className="px-3 py-2 mono">{roomById(state, x.roomId)?.number ?? "—"}</td><td className="px-3 py-2"><ResBadge status={x.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </form>

        <Card className="col-span-12 xl:col-span-4 p-5 xl:sticky xl:top-[72px]">
          <SectionTitle><span className="inline-flex items-center gap-1.5"><History size={14} aria-hidden="true" /> Lịch sử thay đổi</span></SectionTitle>
          <div className="grid grid-cols-2 gap-3 pb-4 mb-4 border-b border-line-soft">
            <div><div className="text-[11px] text-muted">Tạo hồ sơ</div><div className="mono text-[12px] font-semibold text-ink mt-0.5">{fmtStamp(g.createdAt)}</div></div>
            <div><div className="text-[11px] text-muted">Cập nhật lần cuối</div><div className="mono text-[12px] font-semibold text-ink mt-0.5">{entries[0] ? fmtStamp(entries[0].at) : "Chưa sửa lần nào"}</div></div>
          </div>
          <ol className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {entries.map(h => (
              <li key={h.key} className="relative pl-5">
                <span aria-hidden="true" className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${h.key.startsWith("a|") ? "bg-occ" : "bg-accent"}`} />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-[12px] font-semibold text-ink">{fmtStamp(h.at)}</span>
                  <span className="text-[11px] text-muted truncate">{h.by}</span>
                </div>
                <ul className="mt-1.5 space-y-1">{h.lines.map((l, i) => <li key={i} className="text-[12px] leading-snug">{l}</li>)}</ul>
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
