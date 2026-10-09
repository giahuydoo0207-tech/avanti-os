"use client";
import { useState } from "react";
import { CheckCircle, ChevronLeft, Plus, Printer, Send, Trash2 } from "lucide-react";
import { usePms } from "@/lib/pms/store";
import { fmtDate, fmtTime, localDateOf, money, PAYMENT_METHOD_LABEL, SHIFT_LABEL } from "@/lib/pms/format";
import { dashboardStats, guestById, roomById, roomTypeById, txnsOnDate } from "@/lib/pms/selectors";
import type { PaymentMethod, ShiftName, ShiftReport, TaskPriority } from "@/lib/pms/types";
import { Card, EmptyRow, ErrorBox, FieldRow, inputCls, SectionTitle, selectCls, textareaCls } from "../ui";

const PRIORITY: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: "Khẩn", color: "#c1121f", bg: "#fff1f2" }, normal: { label: "Bình thường", color: "#374151", bg: "#f3f4f6" }, info: { label: "Thông tin", color: "#1d4ed8", bg: "#eff6ff" },
};
const currentShift = (): ShiftName => { const h = new Date().getHours(); return h < 14 ? "morning" : h < 22 ? "afternoon" : "night"; };

function Badge({ status }: { status: ShiftReport["status"] }) {
  return status === "confirmed"
    ? <span className="px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#f0fdf4] text-[#15803d] border border-[#86efac]">✓ Đã xác nhận</span>
    : <span className="px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#fff8e1] text-[#7a5800] border border-[#fcd34d]">⏳ Chờ nhận ca</span>;
}

export function ShiftReportTab() {
  const { state, session, today, actions } = usePms();
  const [view, setView] = useState<"new" | "history">("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shift, setShift] = useState<ShiftName>(currentShift);
  const [handover, setHandover] = useState("");
  const [tasks, setTasks] = useState<Array<{ key: number; content: string; priority: TaskPriority; done: boolean }>>([{ key: 1, content: "", priority: "normal", done: false }]);
  const [generalNote, setGeneralNote] = useState("");
  const [incidentNote, setIncidentNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Số liệu ca lấy thẳng từ dữ liệu vận hành
  const st = dashboardStats(state, session.branchId, today);
  const txns = txnsOnDate(state, session.branchId, today);
  const collected = txns.filter(t => t.kind === "credit" && t.paymentMethod).reduce<Record<string, number>>((acc, t) => { acc[t.paymentMethod!] = (acc[t.paymentMethod!] ?? 0) + t.amount; return acc; }, {});
  const cash = collected.cash_vnd ?? 0;
  const [cashBalance, setCashBalance] = useState<string>("");
  const checkIns = state.reservations.filter(r => r.branchId === session.branchId && r.checkedInAt && localDateOf(r.checkedInAt) === today).length;
  const checkOuts = state.reservations.filter(r => r.branchId === session.branchId && r.checkedOutAt && localDateOf(r.checkedOutAt) === today).length;
  const reports = state.shiftReports.filter(r => r.branchId === session.branchId);

  const submit = async () => {
    const r = await actions.submitShiftReport({ businessDate: today, shift, handoverToName: handover, cashBalance: cashBalance === "" ? cash : Number(cashBalance), generalNote, incidentNote, tasks });
    if (!r.ok) return setError(r.error);
    setError(null); setSent(true); setTasks(t => [{ key: t.length ? Math.max(...t.map(x => x.key)) + 1 : 1, content: "", priority: "normal", done: false }]); setGeneralNote(""); setIncidentNote(""); setHandover(""); setCashBalance("");
  };

  const tabs = (
    <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
      <button onClick={() => { setView("new"); setSent(false); }} className={`px-4 py-2 text-[13px] font-bold border-r border-[#e5e7eb] ${view === "new" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}>+ Tạo báo cáo</button>
      <button onClick={() => { setView("history"); setOpenId(null); }} className={`px-4 py-2 text-[13px] font-bold ${view === "history" ? "bg-[#0f0f0e] text-white" : "bg-white text-[#6b7280]"}`}>Lịch sử ({reports.length})</button>
    </div>
  );

  if (view === "history") {
    const rep = reports.find(r => r.id === openId);
    if (rep) {
      const repTasks = state.shiftTasks.filter(t => t.shiftReportId === rep.id);
      return (
        <div className="p-7 max-w-4xl mx-auto space-y-4">
          <button onClick={() => setOpenId(null)} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold"><ChevronLeft size={13} /> Quay lại lịch sử</button>
          <div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Báo cáo giao ca — {SHIFT_LABEL[rep.shift]}</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">{fmtDate(rep.businessDate)}</div></div><Badge status={rep.status} /></div>
          <Card className="p-5"><div className="grid grid-cols-3 gap-4">{[["Người bàn giao", rep.reporterName], ["Người nhận ca", rep.handoverToName], ["Tồn quỹ", `${money(rep.cashBalance)} ₫`], ["Ca", SHIFT_LABEL[rep.shift]], ["Xác nhận bởi", rep.confirmedByName ?? "—"], ["Giờ xác nhận", fmtTime(rep.confirmedAt)]].map(([l, v]) => <div key={l}><div className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5 font-bold">{l}</div><div className="font-bold mono text-[13px]">{v}</div></div>)}</div></Card>
          <Card className="p-5"><SectionTitle>Việc bàn giao — {repTasks.filter(t => !t.done).length} còn lại</SectionTitle>
            <div className="space-y-2">{repTasks.length === 0 && <div className="text-[12px] text-[#9ca3af] font-semibold">Không có việc bàn giao</div>}{repTasks.map(t => (
              <label key={t.id} className="flex items-center gap-3 p-3 rounded-[2px] cursor-pointer" style={{ background: t.done ? "#fafafa" : PRIORITY[t.priority].bg }}>
                <input type="checkbox" checked={t.done} onChange={() => actions.toggleShiftTask(t.id)} className="w-3.5 h-3.5 accent-[#0f0f0e]" />
                <span className={`text-[13px] flex-1 font-semibold ${t.done ? "line-through text-[#9ca3af]" : ""}`}>{t.content}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-[2px] font-bold" style={{ color: PRIORITY[t.priority].color }}>{PRIORITY[t.priority].label}</span>
              </label>
            ))}</div>
          </Card>
          {(rep.generalNote || rep.incidentNote) && <div className="grid grid-cols-2 gap-4">{rep.generalNote && <Card className="p-5"><SectionTitle>Ghi chú chung</SectionTitle><p className="text-[13px] font-semibold">{rep.generalNote}</p></Card>}{rep.incidentNote && <Card className="p-5"><SectionTitle>Sự cố / phàn nàn</SectionTitle><p className="text-[13px] text-[#c1121f] font-bold">{rep.incidentNote}</p></Card>}</div>}
          {rep.status === "submitted" && <button onClick={async () => { const r = await actions.confirmShiftReport(rep.id); setError(r.ok ? null : r.error); }} className="pms-btn-primary"><CheckCircle size={13} /> Xác nhận nhận ca ({session.staffName})</button>}
          <ErrorBox message={error} />
        </div>
      );
    }
    return (
      <div className="p-7 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Lịch sử giao ca</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Shift Handover History</div></div>{tabs}</div>
        <Card className="overflow-hidden"><table className="w-full text-left">
          <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Ngày", "Ca", "Bàn giao", "Nhận ca", "Tồn quỹ", "Trạng thái"].map(h => <th key={h} className="px-5 py-3 text-[10px] tracking-[0.12em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
          <tbody>{reports.length === 0 && <EmptyRow cols={6} text="Chưa có báo cáo" />}{reports.map(r => (
            <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] cursor-pointer">
              <td className="px-5 py-3 mono text-[13px] font-semibold text-[#9ca3af]">{fmtDate(r.businessDate)}</td><td className="px-5 py-3 text-[13px] font-bold">{SHIFT_LABEL[r.shift]}</td>
              <td className="px-5 py-3 text-[13px] font-semibold">{r.reporterName}</td><td className="px-5 py-3 text-[13px] font-semibold text-[#6b7280]">{r.handoverToName}</td>
              <td className="px-5 py-3 mono text-[13px] font-bold">{money(r.cashBalance)} ₫</td><td className="px-5 py-3"><Badge status={r.status} /></td>
            </tr>
          ))}</tbody>
        </table></Card>
      </div>
    );
  }

  if (sent) return (
    <div className="p-7 max-w-4xl mx-auto flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
      <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center shadow-md"><CheckCircle size={28} className="text-[#2d6a4f]" strokeWidth={1.5} /></div>
      <h2 className="text-[16px] font-bold">Đã gửi báo cáo giao ca</h2>
      <p className="text-[13px] text-[#9ca3af] font-semibold">Người nhận ca xác nhận trong mục Lịch sử.</p>
      <div className="flex gap-2"><button onClick={() => setSent(false)} className="pms-btn-secondary">Tạo báo cáo mới</button><button onClick={() => setView("history")} className="pms-btn-primary">Xem lịch sử</button></div>
    </div>
  );

  return (
    <div className="p-7 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Báo cáo giao ca</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">{fmtDate(today)} · {session.staffName}</div></div>{tabs}</div>

      <Card className="p-5">
        <SectionTitle>Số liệu trong ngày (tự động)</SectionTitle>
        <div className="grid grid-cols-6 gap-4">
          {[["Check-in", checkIns], ["Check-out", checkOuts], ["Khách chưa đến", st.arrivalsPending.length], ["Chưa trả phòng", st.departuresPending.length], ["Phòng chờ dọn", st.dirty], ["Công suất", `${st.occupancyPct}%`]].map(([l, v]) => <div key={l as string}><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">{l}</div><div className="mono text-[22px] font-bold">{v}</div></div>)}
        </div>
        <div className="mt-4 pt-4 border-t border-[#f3f4f6] flex gap-6 flex-wrap text-[13px]">
          <span className="font-bold text-[#6b7280]">Đã thu hôm nay:</span>
          {Object.keys(collected).length === 0 && <span className="text-[#9ca3af] font-semibold">Chưa có</span>}
          {(Object.entries(collected) as Array<[PaymentMethod, number]>).map(([m, v]) => <span key={m} className="font-semibold">{PAYMENT_METHOD_LABEL[m]}: <b className="mono">{money(v)} ₫</b></span>)}
        </div>
      </Card>

      {st.arrivalsPending.length > 0 && (
        <Card className="overflow-hidden"><div className="px-5 py-3 border-b border-[#f3f4f6]"><SectionTitle>Khách chưa tới — bàn giao cho ca sau</SectionTitle></div>
          <table className="w-full text-left text-[13px]"><tbody>{st.arrivalsPending.map(r => <tr key={r.id} className="border-b border-[#f9f9f7]"><td className="px-5 py-2 mono text-[#9ca3af]">#{r.confirmationNo}</td><td className="px-5 py-2 font-bold">{guestById(state, r.guestId)?.fullName}</td><td className="px-5 py-2 mono">{roomById(state, r.roomId)?.number ?? "Chưa gán"}</td><td className="px-5 py-2 mono">{roomTypeById(state, r.roomTypeId)?.code}</td><td className="px-5 py-2 text-[#6b7280]">{r.note || "—"}</td></tr>)}</tbody></table>
        </Card>
      )}

      <Card className="p-5"><SectionTitle>Thông tin bàn giao</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <FieldRow label="Người bàn giao"><input className={inputCls} value={session.staffName} readOnly /></FieldRow>
          <FieldRow label="Người nhận ca" required><input className={inputCls} value={handover} onChange={e => setHandover(e.target.value.toUpperCase())} placeholder="Tên lễ tân ca sau" /></FieldRow>
          <FieldRow label="Ca"><select className={selectCls} value={shift} onChange={e => setShift(e.target.value as ShiftName)}>{(Object.keys(SHIFT_LABEL) as ShiftName[]).map(s => <option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}</select></FieldRow>
          <FieldRow label="Tồn quỹ tiền mặt (₫)"><input className={inputCls} type="number" value={cashBalance} onChange={e => setCashBalance(e.target.value)} placeholder={`${money(cash)} (theo giao dịch)`} /></FieldRow>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between"><SectionTitle>Việc cần xử lý cho ca sau</SectionTitle><button onClick={() => setTasks(t => [...t, { key: t.length ? Math.max(...t.map(x => x.key)) + 1 : 1, content: "", priority: "normal", done: false }])} className="flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#1a1a1a] font-bold mb-4"><Plus size={12} /> Thêm việc</button></div>
        <div className="space-y-2">{tasks.map(t => (
          <div key={t.key} className="flex items-center gap-2 p-2.5 rounded-[2px]" style={{ background: PRIORITY[t.priority].bg }}>
            <input className="flex-1 bg-transparent outline-none text-[13px] font-semibold placeholder:text-[#9ca3af]" placeholder="Mô tả việc cần làm..." value={t.content} onChange={e => setTasks(x => x.map(y => (y.key === t.key ? { ...y, content: e.target.value } : y)))} />
            <select className="border border-[#e5e7eb] rounded-[2px] px-2 py-1 text-[12px] bg-white font-bold" value={t.priority} onChange={e => setTasks(x => x.map(y => (y.key === t.key ? { ...y, priority: e.target.value as TaskPriority } : y)))}><option value="urgent">Khẩn</option><option value="normal">Bình thường</option><option value="info">Thông tin</option></select>
            <button onClick={() => setTasks(x => x.filter(y => y.key !== t.key))} className="text-[#d1d5db] hover:text-[#c1121f]"><Trash2 size={13} /></button>
          </div>
        ))}</div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5"><SectionTitle>Ghi chú chung</SectionTitle><textarea className={`${textareaCls} h-24`} value={generalNote} onChange={e => setGeneralNote(e.target.value)} placeholder="Tình hình ca, khách đặc biệt..." /></Card>
        <Card className="p-5"><SectionTitle>Sự cố / phàn nàn</SectionTitle><textarea className={`${textareaCls} h-24`} value={incidentNote} onChange={e => setIncidentNote(e.target.value)} placeholder="Ghi lại sự cố..." /></Card>
      </div>
      <ErrorBox message={error} />
      <div className="flex items-center gap-3"><button onClick={submit} className="pms-btn-primary"><Send size={13} /> Gửi báo cáo giao ca</button><button onClick={() => window.print()} className="pms-btn-secondary"><Printer size={13} /> In</button></div>
    </div>
  );
}
