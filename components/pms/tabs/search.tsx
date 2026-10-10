"use client";
// Tìm kiếm khách / đặt phòng. Bố cục theo màn hình "Search Folio" của SMILE PMS mà lễ tân Avanti quen dùng:
// Thông tin tìm kiếm (trên) · Tìm nâng cao (dưới) · Trạng thái folio + trạng thái đặt phòng · phím tắt F2–F10.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BedDouble, DollarSign, LogIn, LogOut, RotateCcw, Search, User, X } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { diffDays, fmtDate, fold, localDateOf, MEAL_PLAN_LABEL, money, splitName } from "@/lib/pms/format";
import { branchReservations, folioOfReservation, folioTotals, guestById, roomById, roomTypeById } from "@/lib/pms/selectors";
import type { BookingSource, MealPlan, Reservation } from "@/lib/pms/types";
import { COUNTRIES, countryLabel } from "../guest-form";
import { GuestStayDetails } from "../guest-profile";
import { useNav } from "../nav";
import { Card, EmptyRow, ResBadge, SectionTitle } from "../ui";

const SOURCES: BookingSource[] = ["Direct", "Walk-in", "Booking.com", "Agoda", "Expedia", "Traveloka", "Travel Agent"];
const MEALS: MealPlan[] = ["RO", "BB", "HB", "FB"];

type FolioKey = "reserved" | "arrivalToday" | "cancelled" | "noShow" | "inHouse" | "coToday" | "allCo";
const FOLIO_STATUS: Array<{ key: FolioKey; label: string; fkey: string }> = [
  { key: "reserved", label: "Đặt trước", fkey: "F4" },
  { key: "inHouse", label: "Đang ở", fkey: "F5" },
  { key: "arrivalToday", label: "Đến hôm nay", fkey: "F6" },
  { key: "coToday", label: "Đi hôm nay", fkey: "F7" },
  { key: "cancelled", label: "Đã hủy", fkey: "F8" },
  { key: "allCo", label: "Đã trả phòng", fkey: "F10" },
  { key: "noShow", label: "No-show", fkey: "F11" },
];
const FKEY_TO_STATUS: Record<string, FolioKey> = { F4: "reserved", F5: "inHouse", F6: "arrivalToday", F7: "coToday", F8: "cancelled", F10: "allCo", F11: "noShow" };
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

export function SearchTab() {
  const { state, session, today } = usePms();
  const { intent, openOverlay, goTo } = useNav();
  const types = state.roomTypes.filter(t => t.branchId === session.branchId);

  const blank = useCallback((): Filters => ({
    guest: "", room: "", roomType: "", company: "", last: "", first: "", country: "", source: "", meal: "", idType: "", idNo: "",
    arrivalOn: false, arrFrom: today, arrTo: today, departOn: false, depFrom: today, depTo: today,
    stayOver: "", exact: false, folio: DEFAULT_SET, definite: true, tentative: true,
  }), [today]);
  const fromIntent = (): Filters => {
    const f = blank();
    f.guest = intent.search?.query ?? "";
    const p = intent.search?.preset;
    if (p === "arrivals") f.folio = { ...NONE, arrivalToday: true };
    if (p === "departures") f.folio = { ...NONE, coToday: true };
    if (p === "inhouse") f.folio = { ...NONE, inHouse: true };
    return f;
  };
  const [f, setF] = useState<Filters>(fromIntent);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: "arrival" | "room" | "last"; asc: boolean }>({ col: "arrival", asc: true });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF(x => ({ ...x, [k]: v }));
  const toggleFolio = (k: FolioKey) => setF(x => ({ ...x, folio: { ...x.folio, [k]: !x.folio[k] } }));
  const only = (k: FolioKey) => setF({ ...blank(), folio: { ...NONE, [k]: true } });

  // Phím tắt như SMILE: F2 lọc ngày đến, F3 lọc ngày đi, F4–F11 trạng thái folio
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected) return;
      if (e.key === "F2") { e.preventDefault(); setF(x => ({ ...x, arrivalOn: !x.arrivalOn })); return; }
      if (e.key === "F3") { e.preventDefault(); setF(x => ({ ...x, departOn: !x.departOn })); return; }
      const k = FKEY_TO_STATUS[e.key];
      if (k) { e.preventDefault(); setF(x => ({ ...x, folio: { ...x.folio, [k]: !x.folio[k] } })); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

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

  const sel = selected ? state.reservations.find(r => r.id === selected) ?? null : null;
  const lbl = "text-[12px] font-medium text-ink-2";
  const ctl = "w-full border border-line rounded-ctl px-2.5 py-1.5 text-[13px] font-medium text-ink bg-surface outline-none hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15 transition-[border-color,box-shadow] disabled:opacity-40 disabled:bg-sunken";
  const dateCtl = `${ctl} mono`;
  const th = (label: string, col?: "arrival" | "room" | "last", right?: boolean) => (
    <th key={label} scope="col" className={`px-3 py-2.5 text-[11px] font-semibold text-ink-2 whitespace-nowrap ${right ? "text-right" : ""}`}>
      {col ? <button type="button" onClick={() => setSort(s => ({ col, asc: s.col === col ? !s.asc : true }))} className="hover:text-ink">{label}{sort.col === col ? (sort.asc ? " ↑" : " ↓") : ""}</button> : label}
    </th>
  );
  const kbd = (k: string) => <kbd className="mono text-[10px] px-1 py-px rounded border border-line bg-sunken text-muted ml-1.5">{k}</kbd>;

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
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.arrivalOn} onChange={e => set("arrivalOn", e.target.checked)} className="w-3.5 h-3.5 accent-accent" /><span className={lbl}>Ngày đến</span>{kbd("F2")}</label>
                <div className="flex items-center gap-2"><input type="date" aria-label="Ngày đến từ" className={dateCtl} disabled={!f.arrivalOn} value={f.arrFrom} onChange={e => set("arrFrom", e.target.value)} /><span className="text-muted text-[12px]">đến</span><input type="date" aria-label="Ngày đến tới" className={dateCtl} disabled={!f.arrivalOn} value={f.arrTo} onChange={e => set("arrTo", e.target.value)} /></div>
              </div>
              <div className="col-span-5 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.departOn} onChange={e => set("departOn", e.target.checked)} className="w-3.5 h-3.5 accent-accent" /><span className={lbl}>Ngày đi</span>{kbd("F3")}</label>
                <div className="flex items-center gap-2"><input type="date" aria-label="Ngày đi từ" className={dateCtl} disabled={!f.departOn} value={f.depFrom} onChange={e => set("depFrom", e.target.value)} /><span className="text-muted text-[12px]">đến</span><input type="date" aria-label="Ngày đi tới" className={dateCtl} disabled={!f.departOn} value={f.depTo} onChange={e => set("depTo", e.target.value)} /></div>
              </div>
              <label className="col-span-2 space-y-1"><span className={lbl}>Đang lưu trú vào ngày</span>
                <input type="date" className={dateCtl} value={f.stayOver} onChange={e => set("stayOver", e.target.value)} /></label>
            </div>

            <div className="grid grid-cols-12 gap-4 mt-4">
              <fieldset className="col-span-8 border border-line rounded-ctl px-4 pt-2 pb-3">
                <legend className="px-1 text-[12px] font-semibold text-ink-2">Trạng thái folio</legend>
                <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                  {FOLIO_STATUS.map(s => (
                    <label key={s.key} className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                      <input type="checkbox" checked={f.folio[s.key]} onChange={() => toggleFolio(s.key)} className="w-3.5 h-3.5 accent-accent" />{s.label}{kbd(s.fkey)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="col-span-4 border border-line rounded-ctl px-4 pt-2 pb-3">
                <legend className="px-1 text-[12px] font-semibold text-ink-2">Trạng thái đặt phòng</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer"><input type="checkbox" checked={f.definite} onChange={e => set("definite", e.target.checked)} className="w-3.5 h-3.5 accent-accent" />Confirmed</label>
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer"><input type="checkbox" checked={f.tentative} onChange={e => set("tentative", e.target.checked)} className="w-3.5 h-3.5 accent-accent" />Tentative</label>
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer" title="Họ / Tên phải khớp đúng từng chữ"><input type="checkbox" checked={f.exact} onChange={e => set("exact", e.target.checked)} className="w-3.5 h-3.5 accent-accent" />Khớp chính xác Họ/Tên</label>
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
          <span className="text-[12px] text-muted">Bấm vào một dòng để xem hồ sơ khách và thao tác</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 1320 }}>
            <thead><tr className="border-b border-line bg-sunken">
              {th("Trạng thái")}{th("Xác nhận")}{th("Họ", "last")}{th("Tên")}{th("Quốc tịch")}{th("Giấy tờ (ID)")}{th("Phòng", "room")}{th("Loại")}
              {th("Đến", "arrival")}{th("Đi")}{th("Đêm")}{th("Khách")}{th("Nguồn")}{th("Số dư", undefined, true)}
            </tr></thead>
            <tbody>
              {results.length === 0 && <EmptyRow cols={14} text="Không có đặt phòng phù hợp. Thử bỏ bớt bộ lọc hoặc bấm Xóa bộ lọc." />}
              {results.map(r => {
                const g = guestById(state, r.guestId); const room = roomById(state, r.roomId); const folio = folioOfReservation(state, r.id);
                const bal = folio ? folioTotals(state, folio.id).balance : 0;
                const { last, first } = splitName(g?.fullName ?? "");
                const isSel = r.id === selected;
                return (
                  <tr key={r.id} tabIndex={0} aria-selected={isSel} onClick={() => setSelected(r.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(r.id); } }}
                    className={`border-b border-line-soft cursor-pointer outline-none focus-visible:bg-accent-soft ${isSel ? "bg-accent-soft" : "hover:bg-sunken"}`}>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {sel && <GuestDrawer key={sel.id} reservation={sel} onClose={() => setSelected(null)}
          onCheckIn={() => { setSelected(null); openOverlay({ kind: "checkin", reservationId: sel.id }); }}
          onCheckOut={() => { setSelected(null); openOverlay({ kind: "checkout", reservationId: sel.id }); }}
          onFolio={() => { setSelected(null); openOverlay({ kind: "folio", reservationId: sel.id }); }} />}
      </AnimatePresence>
    </div>
  );
}

/** Ngăn chi tiết bên phải: hồ sơ khách đầy đủ + nút thao tác theo trạng thái */
function GuestDrawer({ reservation: r, onClose, onCheckIn, onCheckOut, onFolio }: { reservation: Reservation; onClose: () => void; onCheckIn: () => void; onCheckOut: () => void; onFolio: () => void }) {
  const { state } = usePms();
  const g = guestById(state, r.guestId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const canCheckIn = r.status === "confirmed" || r.status === "tentative";
  return (
    <>
      <motion.div className="fixed inset-0 z-30 bg-night/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.aside role="dialog" aria-modal="true" aria-label={`Hồ sơ khách ${g?.fullName ?? ""}`}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", duration: 0.35, bounce: 0 }}
        className="fixed top-0 right-0 bottom-0 z-40 w-[560px] max-w-full bg-surface border-l border-line flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 h-14 border-b border-line shrink-0">
          <h2 className="text-[15px] font-semibold text-ink truncate">{g?.fullName}</h2>
          <button onClick={onClose} aria-label="Đóng hồ sơ" className="w-8 h-8 flex items-center justify-center rounded-ctl text-muted hover:text-ink hover:bg-line-soft"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
          <GuestStayDetails reservationId={r.id} compact />
        </div>
        <div className="px-6 py-4 border-t border-line flex gap-2 justify-end shrink-0">
          <button onClick={onFolio} className="pms-btn-secondary"><DollarSign size={14} aria-hidden="true" /> Folio</button>
          {canCheckIn && <button onClick={onCheckIn} className="pms-btn-primary"><LogIn size={14} aria-hidden="true" /> Check-in</button>}
          {r.status === "checked_in" && <button onClick={onCheckOut} className="pms-btn-danger"><LogOut size={14} aria-hidden="true" /> Check-out</button>}
        </div>
      </motion.aside>
    </>
  );
}
