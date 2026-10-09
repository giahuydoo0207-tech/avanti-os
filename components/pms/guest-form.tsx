"use client";
import type { GuestInput } from "@/lib/pms/store";
import type { Gender, Guest, GuestType } from "@/lib/pms/types";
import { FieldRow, inputCls, SectionTitle, selectCls } from "./ui";

export const COUNTRIES = [
  { code: "VN", name: "Việt Nam" }, { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" }, { code: "CN", name: "China" },
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "AU", name: "Australia" }, { code: "SG", name: "Singapore" }, { code: "TH", name: "Thailand" }, { code: "MY", name: "Malaysia" },
  { code: "IN", name: "India" }, { code: "TW", name: "Taiwan" }, { code: "HK", name: "Hong Kong" }, { code: "RU", name: "Russia" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" }, { code: "CA", name: "Canada" }, { code: "OTHER", name: "Khác" },
];
export const countryLabel = (code: string) => { const c = COUNTRIES.find(x => x.code === code); return c ? c.name : code; };
const VISA_TYPES = ["E-visa (30 ngày)", "E-visa (90 ngày)", "Visa on Arrival", "Miễn thị thực (15 ngày)", "Miễn thị thực (45 ngày)", "Business visa", "Tourist visa", "Diplomatic visa"];
const PORTS = ["Tân Sơn Nhất (SGN)", "Nội Bài (HAN)", "Đà Nẵng (DAD)", "Cam Ranh (CXR)", "Phú Quốc (PQC)", "Cửa khẩu đường bộ"];

export function emptyGuest(type: GuestType = "vietnamese"): GuestInput {
  return {
    guestType: type, fullName: "", nationality: type === "vietnamese" ? "VN" : "JP", idType: type === "vietnamese" ? "cccd" : "passport", idNumber: "",
    idIssuedDate: null, idIssuedPlace: "", idExpiryDate: null, dob: null, gender: null, phone: "", email: "", address: "", company: "",
    visaType: "", visaNumber: "", visaExpiry: null, entryDate: null, portOfEntry: "",
  };
}
export function guestToInput(g: Guest): GuestInput {
  const { id: _id, branchId: _b, createdAt: _c, ...rest } = g; void _id; void _b; void _c;
  return rest;
}

/** Form thông tin khách, dùng chung cho Đặt phòng và Check-in */
export function GuestFields({ value, onChange, disabled }: { value: GuestInput; onChange: (v: GuestInput) => void; disabled?: boolean }) {
  const set = <K extends keyof GuestInput>(k: K, v: GuestInput[K]) => onChange({ ...value, [k]: v });
  const d = (v: string) => (v ? v : null);
  const vn = value.guestType === "vietnamese";
  return (
    <div className="space-y-3">
      <FieldRow label="Họ và tên" required><input disabled={disabled} className={inputCls} value={value.fullName} onChange={e => set("fullName", e.target.value.toUpperCase())} placeholder={vn ? "NGUYỄN VĂN A" : "TANAKA HIROSHI"} /></FieldRow>
      {!vn && <FieldRow label="Quốc tịch"><select disabled={disabled} className={selectCls} value={value.nationality} onChange={e => set("nationality", e.target.value)}>{COUNTRIES.filter(c => c.code !== "VN").map(c => <option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select></FieldRow>}
      <FieldRow label={vn ? "Số CCCD" : "Passport No."}><input disabled={disabled} className={inputCls} value={value.idNumber} onChange={e => set("idNumber", e.target.value.toUpperCase())} placeholder={vn ? "0xx xxxx xxxx" : "TK1234567"} /></FieldRow>
      {vn
        ? <>
          <FieldRow label="Nơi cấp"><input disabled={disabled} className={inputCls} value={value.idIssuedPlace} onChange={e => set("idIssuedPlace", e.target.value)} placeholder="Cục CS QLHC về TTXH" /></FieldRow>
          <FieldRow label="Ngày cấp"><input disabled={disabled} type="date" className={inputCls} value={value.idIssuedDate ?? ""} onChange={e => set("idIssuedDate", d(e.target.value))} /></FieldRow>
        </>
        : <FieldRow label="Passport hết hạn"><input disabled={disabled} type="date" className={inputCls} value={value.idExpiryDate ?? ""} onChange={e => set("idExpiryDate", d(e.target.value))} /></FieldRow>}
      <FieldRow label="Ngày sinh"><input disabled={disabled} type="date" className={inputCls} value={value.dob ?? ""} onChange={e => set("dob", d(e.target.value))} /></FieldRow>
      <FieldRow label="Giới tính"><select disabled={disabled} className={selectCls} value={value.gender ?? ""} onChange={e => set("gender", (e.target.value || null) as Gender | null)}><option value="">—</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></FieldRow>
      <FieldRow label="Điện thoại"><input disabled={disabled} className={inputCls} value={value.phone} onChange={e => set("phone", e.target.value)} placeholder={vn ? "09xx xxx xxx" : "+81 …"} /></FieldRow>
      <FieldRow label="Email"><input disabled={disabled} className={inputCls} value={value.email} onChange={e => set("email", e.target.value)} /></FieldRow>
      {vn && <FieldRow label="Địa chỉ"><input disabled={disabled} className={inputCls} value={value.address} onChange={e => set("address", e.target.value)} placeholder="Quận, TP…" /></FieldRow>}
      <FieldRow label="Công ty / TA"><input disabled={disabled} className={inputCls} value={value.company} onChange={e => set("company", e.target.value)} /></FieldRow>
      {!vn && (
        <div className="pt-2">
          <SectionTitle>Khai báo tạm trú (PC06)</SectionTitle>
          <div className="space-y-3">
            <FieldRow label="Loại visa"><select disabled={disabled} className={selectCls} value={value.visaType} onChange={e => set("visaType", e.target.value)}><option value="">—</option>{VISA_TYPES.map(v => <option key={v}>{v}</option>)}</select></FieldRow>
            <FieldRow label="Số visa"><input disabled={disabled} className={inputCls} value={value.visaNumber} onChange={e => set("visaNumber", e.target.value)} /></FieldRow>
            <FieldRow label="Visa hết hạn"><input disabled={disabled} type="date" className={inputCls} value={value.visaExpiry ?? ""} onChange={e => set("visaExpiry", d(e.target.value))} /></FieldRow>
            <FieldRow label="Ngày nhập cảnh"><input disabled={disabled} type="date" className={inputCls} value={value.entryDate ?? ""} onChange={e => set("entryDate", d(e.target.value))} /></FieldRow>
            <FieldRow label="Cửa khẩu"><select disabled={disabled} className={selectCls} value={value.portOfEntry} onChange={e => set("portOfEntry", e.target.value)}><option value="">—</option>{PORTS.map(p => <option key={p}>{p}</option>)}</select></FieldRow>
          </div>
        </div>
      )}
    </div>
  );
}
