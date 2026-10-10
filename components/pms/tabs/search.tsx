"use client";
// Tìm kiếm khách / đặt phòng. Bố cục theo màn hình "Search Folio" của SMILE PMS mà lễ tân Avanti quen dùng:
// Thông tin tìm kiếm (trên) · Tìm nâng cao (dưới) · Trạng thái folio + trạng thái đặt phòng.
// Bấm một dòng → mở tab Hồ sơ khách; quay lại thì bộ lọc được giữ nguyên.
import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, ChevronRight, RotateCcw, Search, User } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { diffDays, fmtDate, fold, localDateOf, MEAL_PLAN_LABEL, money, splitName } from "@/lib/pms/format";
import { branchReservations, folioOfReservation, folioTotals, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { BookingSource, MealPlan, Reservation } from "@/lib/pms/types";
import { COUNTRIES, countryLabel } from "../guest-form";
import { useNav } from "../nav";
import { Card, EmptyRow, ResBadge, SectionTitle } from "../ui";

const SOURCES: BookingSource[] = ["Direct", "Walk-in", "Booking.com", "Agoda", "Expedia", "Traveloka", "Travel Agent"];
const MEALS: MealPlan[] = ["RO", "BB", "HB", "FB"];

type FolioKey = "reserved" | "arrivalToday" | "cancelled" | "noShow" | "inHouse" | "coToday" | "allCo";
const FOLIO_STATUS: Array<{ key: FolioKey; label: string }> = [
  { key: "reserved", label: "Đặt trước" },
  { key: "inHouse", label: "Đang ở" },
  { key: "arrivalToday", label: "Đến hôm nay" },
  { key: "coToday", label: "Đi hôm nay" },
  { key: "cancelled", label: "Đã hủy" },
  { key: "allCo", label: "Đã trả phòng" },
  { key: "noShow", label: "No-show" },
];
type FolioSet = Record<FolioKey, boolean>;
const NONE: FolioSet = { reserved: false, arrivalToday: false, cancelled: false, noShow: false, inHouse: false, coToday: false, allCo: false };
const DEFAULT_SET: FolioSet = { ...NONE, reserved: true, arrivalToday: true, inHouse: true };

interface Filters {
  guest: string; room: string; roomType: string; company: string;
  last: string; first: string; country: string; source: string; meal: string;
  idType: "" | "cccd" | "passport"; idNo: string;
  arrivalOn: boolean; arrFrom: string; arrTo: string;
  departOn: boolean; depFrom: string; depTo: string;
  stayOver: string; exact: boolean;
  folio: FolioSet; definite: boolean; tentative: boolean;
}
type SortState = { col: "arrival" | "room" | "last"; asc: boolean };
// Bộ lọc gần nhất, để quay lại từ Hồ sơ khách vẫn thấy đúng danh sách cũ
let lastSearch: { f: Filters; sort: SortState } | null = null;

/** Ô tích dạng thẻ, mọi ô cùng kích thước để bảng lọc thẳng hàng */
function CheckTile({ checked, onChange, children, title }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; title?: string }) {
  return (
    <label title={title} className={`flex items-center gap-2.5 h-9 px-3 rounded-ctl border text-[13px] font-medium cursor-pointer select-none transition-colors ${checked ? "border-accent/60 bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 shrink-0 accent-accent" />
      <span className="truncate">{children}</span>
    </label>
  );
}

export function SearchTab() {
  const { state, session, today } = usePms();
  const { intent, goTo } = useNav();
  const types = state.roomTypes.filter(t => t.branchId === session.branchId);

  const blank = useCallback((): Filters => ({
    guest: "", room: "", roomType: "", company: "", last: "", first: "", country: "", source: "", meal: "", idType: "", idNo: "",
    arrivalOn: false, arrFrom: today, arrTo: today, departOn: false, depFrom: today, depTo: today,
    stayOver: "", exact: false, folio: DEFAULT_SET, definite: true, tentative: true,
  }), [today]);
  const fromIntent = (): Filters => {
    if (intent.search?.restore && lastSearch) return lastSearch.f;
    const f = blank();
    f.guest = intent.search?.query ?? "";
    const p = intent.search?.preset;
    if (p === "arrivals") f.folio = { ...NONE, arrivalToday: true };
    if (p === "departures") f.folio = { ...NONE, coToday: true };
    if (p === "inhouse") f.folio = { ...NONE, inHouse: true };
    return f;
  };
  const [f, setF] = useState<Filters>(fromIntent);
  const [sort, setSort] = useState<SortState>(() => (intent.search?.restore && lastSearch ? lastSearch.sort : { col: "arrival", asc: true }));
  useEffect(() => { lastSearch = { f, sort }; }, [f, sort]);
  const openProfile = (id: string) => goTo("Hồ sơ khách", { profile: { reservationId: id } });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF(x => ({ ...x, [k]: v }));
  const toggleFolio = (k: FolioKey) => setF(x => ({ ...x, folio: { ...x.folio, [k]: !x.folio[k] } }));
  const only = (k: FolioKey) => setF({ ...blank(), folio: { ...NONE, [k]: true } });

  const results = useMemo(() => {
    const m = (hay: string, needle: string) => { const n = fold(needle); if (!n) return true; const h = fold(hay); return f.exact ? h === n : h.includes(n); };
    const anyFolio = Object.values(f.folio).some(Boolean);
    const list = branchReservations(state, session.branchId).filter(r => {
      const g = guestById(state, r.guestId);
      const room = roomById(state, r.roomId);
      const folio = folioOfReservation(state, r.id);
      const { last, first } = splitName(g?.fullName ?? "");

      // Trạng thái folio (OR giữa các ô đã chọn)
      if (anyFolio) {
        const coDate = r.checkedOutAt ? localDateOf(r.checkedOutAt) : null;
        const hit =
          (f.folio.reserved && (r.status === "tentative" || r.status === "confirmed")) ||
          (f.folio.arrivalToday && r.arrivalDate === today && (r.status === "tentative" || r.status === "confirmed" || r.status === "checked_in")) ||
          (f.folio.inHouse && r.status === "checked_in") ||
          (f.folio.coToday && ((r.status === "checked_in" && r.departureDate === today) || (r.status === "checked_out" && coDate === today))) ||
          (f.folio.allCo && r.status === "checked_out") ||
          (f.folio.cancelled && r.status === "cancelled") ||
          (f.folio.noShow && r.status === "no_show");
        if (!hit) return false;
      }
      // Trạng thái đặt phòng: chỉ áp dụng cho đặt phòng chưa nhận
      if (r.status === "confirmed" && !f.definite) return false;
      if (r.status === "tentative" && !f.tentative) return false;

      const q = fold(f.guest);
      if (q && !(fold(g?.fullName ?? "").includes(q) || r.confirmationNo.includes(q) || folio?.folioNo.includes(q) || (g?.phone ?? "").includes(q) || fold(g?.idNumber ?? "").includes(q) || fold(g?.email ?? "").includes(q))) return false;
      if (f.room && !(room?.number ?? "").startsWith(f.room.trim())) return false;
      if (f.roomType && (room?.roomTypeId ?? r.roomTypeId) !== f.roomType) return false;
      if (!m(last, f.last) || !m(first, f.first)) return false;
      if (f.company && !fold(g?.company ?? "").includes(fold(f.company))) return false;
      if (f.idType && g?.idType !== f.idType) return false;
      if (f.idNo && !(g?.idNumber ?? "").replace(/\s/g, "").toUpperCase().includes(f.idNo.replace(/\s/g, "").toUpperCase())) return false;
      if (f.country && g?.nationality !== f.country) return false;
      if (f.source && r.source !== f.source) return false;
      if (f.meal && r.mealPlan !== f.meal) return false;
      if (f.arrivalOn && !(r.arrivalDate >= f.arrFrom && r.arrivalDate <= f.arrTo)) return false;
      if (f.departOn && !(r.departureDate >= f.depFrom && r.departureDate <= f.depTo)) return false;
      if (f.stayOver && !(r.arrivalDate <= f.stayOver && r.departureDate > f.stayOver)) return false;
      return true;
    });
    const key = (r: Reservation) => sort.col === "arrival" ? r.arrivalDate : sort.col === "room" ? (roomById(state, r.roomId)?.number ?? "~") : splitName(guestById(state, r.guestId)?.fullName ?? "").last;
    return list.sort((a, b) => (sort.asc ? 1 : -1) * key(a).localeCompare(key(b)));
  }, [state, session.branchId, f, sort, today]);

  const lbl = "text-[12px] font-medium text-ink-2";
  const ctl = "w-full border border-line rounded-ctl px-2.5 py-1.5 text-[13px] font-medium text-ink bg-surface outline-none hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15 transition-[border-color,box-shadow] disabled:opacity-40 disabled:bg-sunken";
  const dateCtl = `${ctl} mono`;
  const th = (label: string, col?: "arrival" | "room" | "last", right?: boolean) => (
    <th key={label} scope="col" className={`px-3 py-2.5 text-[11px] font-semibold text-ink-2 whitespace-nowrap ${right ? "text-right" : ""}`}>
      {col ? <button type="button" onClick={() => setSort(s => ({ col, asc: s.col === col ? !s.asc : true }))} className="hover:text-ink">{label}{sort.col === col ? (sort.asc ? " ↑" : " ↓") : ""}</button> : label}
    </th>
  );

  return (
    <div className="p-7 max-w-7xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div><h2 className="text-[20px] font-semibold tracking-tight text-ink">Tìm kiếm</h2><div className="text-[13px] text-muted mt-0.5">Tìm folio theo khách, phòng, ngày và trạng thái</div></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => only("arrivalToday")} className="pms-btn-secondary">Khách đến hôm nay</button>
          <button onClick={() => only("coToday")} className="pms-btn-secondary">Khách đi hôm nay</button>
          <button onClick={() => only("inHouse")} className="pms-btn-secondary">Đang ở</button>
          <button onClick={() => goTo("Đặt phòng", { reservation: { walkIn: true } })} className="pms-btn-secondary"><User size={14} aria-hidden="true" /> Walk In</button>
          <button onClick={() => goTo("Đặt phòng")} className="pms-btn-accent"><BedDouble size={14} aria-hidden="true" /> Đặt phòng mới</button>
        </div>
      </div>

      <Card className="p-5">
        <form role="search" onSubmit={e => e.preventDefault()} className="space-y-5">
          {/* Thông tin tìm kiếm */}
          <section>
            <SectionTitle>Thông tin tìm kiếm</SectionTitle>
            <div className="grid grid-cols-12 gap-x-4 gap-y-3">
              <label className="col-span-5 space-y-1"><span className={lbl}>Thông tin khách</span>
                <input className={ctl} value={f.guest} onChange={e => set("guest", e.target.value)} placeholder="Tên, số xác nhận, folio, SĐT, giấy tờ, email…" autoComplete="off" /></label>
              <label className="col-span-2 space-y-1"><span className={lbl}>Số phòng</span>
                <input className={`${ctl} mono`} value={f.room} onChange={e => set("room", e.target.value)} placeholder="vd: 305" inputMode="numeric" autoComplete="off" /></label>
              <label className="col-span-2 space-y-1"><span className={lbl}>Loại phòng</span>
                <select className={ctl} value={f.roomType} onChange={e => set("roomType", e.target.value)}><option value="">Tất cả</option>{types.map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select></label>
              <label className="col-span-3 space-y-1"><span className={lbl}>Công ty / TA</span>
                <input className={ctl} value={f.company} onChange={e => set("company", e.target.value)} placeholder="vd: Du lịch Biển Xanh" autoComplete="off" /></label>
            </div>
          </section>

          {/* Tìm nâng cao */}
          <section className="pt-4 border-t border-line-soft">
            <SectionTitle>Tìm nâng cao</SectionTitle>
            <div className="grid grid-cols-12 gap-x-4 gap-y-3">
              <label className="col-span-3 space-y-1"><span className={lbl}>Họ (Last name)</span>
                <input className={ctl} value={f.last} onChange={e => set("last", e.target.value)} placeholder="vd: Nguyễn" autoComplete="off" /></label>
              <label className="col-span-3 space-y-1"><span className={lbl}>Tên (First name)</span>
                <input className={ctl} value={f.first} onChange={e => set("first", e.target.value)} placeholder="vd: Văn An" autoComplete="off" /></label>
              <label className="col-span-2 space-y-1"><span className={lbl}>Quốc tịch</span>
                <select className={ctl} value={f.country} onChange={e => set("country", e.target.value)}><option value="">Tất cả</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
              <label className="col-span-2 space-y-1"><span className={lbl}>Nguồn đặt</span>
                <select className={ctl} value={f.source} onChange={e => set("source", e.target.value)}><option value="">Tất cả</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></label>
              <label className="col-span-2 space-y-1"><span className={lbl}>Gói ăn</span>
                <select className={ctl} value={f.meal} onChange={e => set("meal", e.target.value)}><option value="">Tất cả</option>{MEALS.map(x => <option key={x} value={x}>{MEAL_PLAN_LABEL[x]}</option>)}</select></label>

              <label className="col-span-3 space-y-1"><span className={lbl}>Loại giấy tờ (ID)</span>
                <select className={ctl} value={f.idType} onChange={e => set("idType", e.target.value as Filters["idType"])}><option value="">Tất cả</option><option value="cccd">Căn cước công dân (CCCD)</option><option value="passport">Hộ chiếu (Passport)</option></select></label>
              <label className="col-span-3 space-y-1"><span className={lbl}>{f.idType === "passport" ? "Số hộ chiếu" : f.idType === "cccd" ? "Số CCCD (12 số)" : "Số CCCD / Hộ chiếu"}</span>
                <input className={`${ctl} mono uppercase`} value={f.idNo} onChange={e => set("idNo", e.target.value)} placeholder={f.idType === "passport" ? "vd: TK1234567" : "vd: 079203001234"} inputMode={f.idType === "cccd" ? "numeric" : "text"} autoComplete="off" spellCheck={false} /></label>
              <div className="col-span-6" aria-hidden="true" />

              <div className="col-span-5 space-y-1">
                <label className="flex items-center gap-2 h-5 cursor-pointer"><input type="checkbox" checked={f.arrivalOn} onChange={e => set("arrivalOn", e.target.checked)} className="w-4 h-4 accent-accent" /><span className={lbl}>Lọc theo ngày đến</span></label>
                <div className="flex items-center gap-2"><input type="date" aria-label="Ngày đến từ" className={dateCtl} disabled={!f.arrivalOn} value={f.arrFrom} onChange={e => set("arrFrom", e.target.value)} /><span className="text-muted text-[12px]">đến</span><input type="date" aria-label="Ngày đến tới" className={dateCtl} disabled={!f.arrivalOn} value={f.arrTo} onChange={e => set("arrTo", e.target.value)} /></div>
              </div>
              <div className="col-span-5 space-y-1">
                <label className="flex items-center gap-2 h-5 cursor-pointer"><input type="checkbox" checked={f.departOn} onChange={e => set("departOn", e.target.checked)} className="w-4 h-4 accent-accent" /><span className={lbl}>Lọc theo ngày đi</span></label>
                <div className="flex items-center gap-2"><input type="date" aria-label="Ngày đi từ" className={dateCtl} disabled={!f.departOn} value={f.depFrom} onChange={e => set("depFrom", e.target.value)} /><span className="text-muted text-[12px]">đến</span><input type="date" aria-label="Ngày đi tới" className={dateCtl} disabled={!f.departOn} value={f.depTo} onChange={e => set("depTo", e.target.value)} /></div>
              </div>
              <label className="col-span-2 space-y-1"><span className={`${lbl} flex items-center h-5`}>Đang lưu trú vào ngày</span>
                <input type="date" className={dateCtl} value={f.stayOver} onChange={e => set("stayOver", e.target.value)} /></label>
            </div>

            <div className="grid grid-cols-12 gap-4 mt-4">
              <fieldset className="col-span-12 lg:col-span-8 border border-line rounded-ctl px-4 pt-2 pb-4">
                <legend className="px-1 text-[12px] font-semibold text-ink-2">Trạng thái folio</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FOLIO_STATUS.map(s => <CheckTile key={s.key} checked={f.folio[s.key]} onChange={() => toggleFolio(s.key)}>{s.label}</CheckTile>)}
                </div>
              </fieldset>
              <fieldset className="col-span-12 lg:col-span-4 border border-line rounded-ctl px-4 pt-2 pb-4">
                <legend className="px-1 text-[12px] font-semibold text-ink-2">Trạng thái đặt phòng</legend>
                <div className="grid grid-cols-2 gap-2">
                  <CheckTile checked={f.definite} onChange={v => set("definite", v)}>Confirmed</CheckTile>
                  <CheckTile checked={f.tentative} onChange={v => set("tentative", v)}>Tentative</CheckTile>
                  <CheckTile checked={f.exact} onChange={v => set("exact", v)} title="Họ / Tên phải khớp đúng từng chữ">Khớp chính xác</CheckTile>
                </div>
              </fieldset>
            </div>
          </section>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[12px] text-muted">Kết quả cập nhật ngay khi gõ. Tìm không phân biệt dấu: “nguyen” khớp “NGUYỄN”.</p>
            <button type="button" onClick={() => setF(blank())} className="pms-btn-secondary"><RotateCcw size={14} aria-hidden="true" /> Xóa bộ lọc</button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
          <span className="text-[13px] font-semibold flex items-center gap-1.5" aria-live="polite"><Search size={14} aria-hidden="true" />{results.length} kết quả</span>
          <span className="text-[12px] text-muted">Bấm vào một dòng để mở hồ sơ khách</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 1320 }}>
            <thead><tr className="border-b border-line bg-sunken">
              {th("Trạng thái")}{th("Xác nhận")}{th("Họ", "last")}{th("Tên")}{th("Quốc tịch")}{th("Giấy tờ (ID)")}{th("Phòng", "room")}{th("Loại")}
              {th("Đến", "arrival")}{th("Đi")}{th("Đêm")}{th("Khách")}{th("Nguồn")}{th("Số dư", undefined, true)}<th scope="col" className="w-8" aria-label="Mở hồ sơ" />
            </tr></thead>
            <tbody>
              {results.length === 0 && <EmptyRow cols={15} text="Không có đặt phòng phù hợp. Thử bỏ bớt bộ lọc hoặc bấm Xóa bộ lọc." />}
              {results.map(r => {
                const g = guestById(state, r.guestId); const room = roomById(state, r.roomId); const folio = folioOfReservation(state, r.id);
                const bal = folio ? folioTotals(state, folio.id).balance : 0;
                const { last, first } = splitName(g?.fullName ?? "");
                return (
                  <tr key={r.id} tabIndex={0} onClick={() => openProfile(r.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProfile(r.id); } }}
                    className="group border-b border-line-soft cursor-pointer outline-none hover:bg-sunken focus-visible:bg-accent-soft">
                    <td className="px-3 py-2.5"><ResBadge status={r.status} /></td>
                    <td className="px-3 py-2.5 mono text-[12px] text-ink-2">#{r.confirmationNo}</td>
                    <td className="px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap">{last}</td>
                    <td className="px-3 py-2.5 text-[13px] font-medium max-w-[180px] truncate">{first}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-2 whitespace-nowrap">{countryLabel(g?.nationality ?? "")}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{g?.idNumber ? <><span className="text-[10px] font-semibold text-muted mr-1.5">{g.idType === "cccd" ? "CCCD" : "PP"}</span><span className="mono text-[12px] text-ink-2">{g.idNumber}</span></> : <span className="text-[12px] text-faint">Chưa có</span>}</td>
                    <td className="px-3 py-2.5 mono text-[13px] font-semibold">{room ? room.number : <span className="text-[11px] text-occ-ink font-sans">Chưa gán</span>}</td>
                    <td className="px-3 py-2.5"><span className="mono text-[11px] px-1.5 py-0.5 bg-line-soft rounded">{roomTypeById(state, room?.roomTypeId ?? r.roomTypeId)?.code}</span></td>
                    <td className={`px-3 py-2.5 mono text-[12px] ${r.arrivalDate === today ? "text-clean font-semibold" : "text-ink-2"}`}>{fmtDate(r.arrivalDate)}</td>
                    <td className={`px-3 py-2.5 mono text-[12px] ${r.departureDate === today ? "text-dirty font-semibold" : "text-ink-2"}`}>{fmtDate(r.departureDate)}</td>
                    <td className="px-3 py-2.5 mono text-[12px] text-ink-2">{diffDays(r.arrivalDate, r.departureDate)}</td>
                    <td className="px-3 py-2.5 mono text-[12px] text-muted">{r.adults}/{r.children}</td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-2 whitespace-nowrap">{r.source}</td>
                    <td className={`px-3 py-2.5 mono text-[12px] text-right font-semibold ${bal > 0 ? "text-dirty" : "text-clean"}`}>{money(bal)}</td>
                    <td className="pr-3 py-2.5 text-faint group-hover:text-ink"><ChevronRight size={14} aria-hidden="true" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
