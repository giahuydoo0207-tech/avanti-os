"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, BedDouble, LayoutGrid, Search, DollarSign, ClipboardList, CalendarDays, User } from "lucide-react";

type Role = {
  id: string;
  code: string;
  label: string;
  labelEn: string;
  desc: string;
  icon: React.ElementType;
  access: string[];
};

const ROLES: Role[] = [
  {
    id: "gm",
    code: "GM",
    label: "Tổng Giám Đốc",
    labelEn: "General Manager",
    desc: "Tổng quan toàn hệ thống, báo cáo doanh thu, công việc phòng",
    icon: LayoutGrid,
    access: ["Tổng quan","Báo cáo","Room Availability","Sơ đồ phòng","Room Plan"],
  },
  {
    id: "kt",
    code: "KT",
    label: "Kế Toán Viên",
    labelEn: "Accountant",
    desc: "Folio, thu ngân, công nợ AR, báo cáo tài chính",
    icon: DollarSign,
    access: ["Thu ngân","Báo cáo","Room Availability","Tìm kiếm"],
  },
  {
    id: "lt",
    code: "LT",
    label: "Lễ Tân",
    labelEn: "Front Desk",
    desc: "Check-in, check-out, đặt phòng, giao ca",
    icon: BedDouble,
    access: ["Tổng quan","Tìm kiếm","Sơ đồ phòng","Room Plan","Đặt phòng","Báo cáo","Thu ngân"],
  },
  {
    id: "ql",
    code: "QL",
    label: "Người Giám Sát",
    labelEn: "Supervisor",
    desc: "Giám sát vận hành, sơ đồ phòng, sơ đồ phòng",
    icon: Search,
    access: ["Tổng quan","Sơ đồ phòng","Room Plan","Tìm kiếm","Báo cáo","Room Availability"],
  },
  {
    id: "hk",
    code: "HK",
    label: "Dọn Dẹp Nhà Cửa",
    labelEn: "Housekeeping",
    desc: "Phòng trang thái, lịch trình, báo cáo",
    icon: CalendarDays,
    access: ["Sơ đồ phòng","Báo cáo"],
  },
];

export default function AvantiLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("avanti");
  const [showBranchList, setShowBranchList] = useState(false);

  const handleLogin = () => {
    if (!name.trim()) { setError("Vui lòng nhập họ và tên"); return; }
    if (!selectedRole) { setError("Vui lòng chọn vai trò"); return; }
    setError("");
    if(typeof window!=="undefined"){
      localStorage.setItem("staffName", name.trim());
      localStorage.setItem("staffRole", selectedRole!);
    }
    router.push("/dashboard");
  };

  const role = ROLES.find(r => r.id === selectedRole);

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',Arial,sans-serif", background: "#f2f2ef" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        .mono { font-family: 'DM Mono', 'Courier New', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #3a3a38; border-radius: 2px; }
      `}</style>

      {/* LEFT PANEL — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0"
        style={{ background: "#0f0f0e", borderRight: "1px solid #1c1c1a" }}
      >
        {/* TOP — Avanti Hotel */}
        <button
          onClick={()=>setSelectedBranch("avanti")}
          className="flex items-center justify-between px-10 py-8 transition-colors hover:bg-[#1c1c1a] text-left"
          style={{borderBottom:"1px solid #1c1c1a", background: selectedBranch==="avanti"?"#1c1c1a":"transparent"}}
        >
          <div>
            <div className="text-[9px] tracking-[0.22em] text-[#3a3a38] uppercase mb-2">Property Management System</div>
            <div className="text-[26px] font-semibold tracking-tight text-white leading-tight">Avanti OS</div>
            <div className="mono text-[11px] text-[#5c5c58] mt-1">v6.081 · Build 2026</div>
            <div className="mt-4 text-[11px] font-medium" style={{color: selectedBranch==="avanti"?"#ffffff":"#5c5c58"}}>
              Avanti Hotel
            </div>

          </div>
          <ChevronRight size={16} strokeWidth={1.5} style={{color: selectedBranch==="avanti"?"#ffffff":"#3a3a38", flexShrink:0}}/>
        </button>

        {/* MIDDLE — Branch location bar */}
        <div className="flex-1 flex flex-col justify-center px-10">
          <div className="text-[9px] tracking-[0.18em] uppercase text-[#3a3a38] mb-4">Chi nhánh đang chọn</div>
          <div
            className="flex items-center justify-between px-4 py-3 rounded-[2px] cursor-pointer"
            style={{background:"#1c1c1a", border:"1px solid #2a2a28"}}
            onClick={()=>setShowBranchList(s=>!s)}
          >
            <div>
              <div className="text-[12px] font-semibold text-white">
                {selectedBranch==="avanti"?"Avanti Hotel":"Avanti Boutique"}
              </div>

            </div>
            <ChevronRight
              size={14} strokeWidth={1.5}
              style={{color:"#5c5c58", flexShrink:0, transform: showBranchList?"rotate(90deg)":"rotate(0deg)", transition:"transform 0.15s"}}
            />
          </div>
          {showBranchList&&(
            <div className="mt-1 rounded-[2px] overflow-hidden" style={{border:"1px solid #2a2a28"}}>
              {[
                {id:"avanti",  name:"Avanti Hotel",    addr:"Quận 1, TP.HCM",  rooms:105, stars:"4★"},
                {id:"boutique",name:"Avanti Boutique",  addr:"Quận 3, TP.HCM",  rooms:42,  stars:"3★"},
              ].map(b=>(
                <button key={b.id} onClick={()=>{setSelectedBranch(b.id);setShowBranchList(false);}}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#252523]"
                  style={{background: selectedBranch===b.id?"#252523":"#1c1c1a", borderBottom:"1px solid #2a2a28"}}
                >
                  <div>
                    <div className={`text-[12px] font-medium ${selectedBranch===b.id?"text-white":"text-[#7a7a75]"}`}>{b.name}</div>
                    <div className="mono text-[10px] text-[#3a3a38]">{b.rooms} phòng · {b.stars}</div>
                  </div>
                  {selectedBranch===b.id&&<span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"/>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM — Avanti Boutique */}
        <button
          onClick={()=>setSelectedBranch("boutique")}
          className="flex items-center justify-between px-10 py-8 transition-colors hover:bg-[#1c1c1a] text-left"
          style={{borderTop:"1px solid #1c1c1a", background: selectedBranch==="boutique"?"#1c1c1a":"transparent"}}
        >
          <div>
            <div className="text-[9px] tracking-[0.22em] text-[#3a3a38] uppercase mb-2">Chi nhánh 2</div>
            <div className="text-[18px] font-semibold tracking-tight leading-tight" style={{color: selectedBranch==="boutique"?"#ffffff":"#5c5c58"}}>
              Avanti Boutique
            </div>

          </div>
          <ChevronRight size={16} strokeWidth={1.5} style={{color: selectedBranch==="boutique"?"#ffffff":"#3a3a38", flexShrink:0}}/>
        </button>
      </div>

      {/* RIGHT PANEL — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="text-[9px] tracking-[0.2em] uppercase text-[#9ca3af] mb-1">Property Management</div>
            <div className="text-[22px] font-semibold text-[#1a1a1a]">Avanti OS</div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[20px] font-semibold text-[#1a1a1a] mb-1">Đăng nhập</h1>
            <div className="text-[12px] text-[#9ca3af]">
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
          </div>

          {/* Name input */}
          <div className="mb-5">
            <label className="block text-[11px] font-medium text-[#374151] uppercase tracking-[0.1em] mb-2">
              Họ và tên nhân viên
            </label>
            <div className="flex items-center gap-3 bg-white border border-[#e5e7eb] rounded-[2px] px-4 py-3 focus-within:border-[#6b7280] transition-colors">
              <User size={14} strokeWidth={1.5} className="text-[#d1d5db] shrink-0" />
              <input
                className="flex-1 text-[13px] outline-none bg-transparent placeholder:text-[#d1d5db] font-semibold"
                style={{color: name ? "#0f0f0e" : undefined, letterSpacing: name ? "0.04em" : undefined}}
                placeholder="NGUYỄN VĂN A"
                value={name}
                onChange={e => { setName(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <label className="block text-[11px] font-medium text-[#374151] uppercase tracking-[0.1em] mb-2">
              Vai trò
            </label>
            <div className="space-y-2">
              {ROLES.map(r => {
                const Icon = r.icon;
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedRole(r.id); setError(""); }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-[2px] border text-left transition-all"
                    style={{
                      background: isSelected ? "#0f0f0e" : "#ffffff",
                      borderColor: isSelected ? "#0f0f0e" : "#e5e7eb",
                      boxShadow: isSelected ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Code badge */}
                    <div
                      className="w-9 h-9 rounded-[2px] flex items-center justify-center shrink-0"
                      style={{
                        background: isSelected ? "#252523" : "#f3f4f6",
                      }}
                    >
                      <span
                        className="mono text-[11px] font-semibold"
                        style={{ color: isSelected ? "#ffffff" : "#374151" }}
                      >
                        {r.code}
                      </span>
                    </div>
                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: isSelected ? "#ffffff" : "#1a1a1a" }}
                        >
                          {r.label}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: isSelected ? "#7a7a75" : "#9ca3af" }}
                        >
                          {r.labelEn}
                        </span>
                      </div>
                      <div
                        className="text-[11px] mt-0.5 truncate"
                        style={{ color: isSelected ? "#9ca3af" : "#6b7280" }}
                      >
                        {r.desc}
                      </div>
                    </div>
                    {/* Arrow */}
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      style={{ color: isSelected ? "#5c5c58" : "#d1d5db", flexShrink: 0 }}
                    />
                  </button>
                );
              })}
            </div>
          </div>



          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-[2px] bg-[#fff1f2] border border-[#fca5a5] text-[11px] text-[#c1121f]">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[2px] text-[13px] font-semibold transition-colors"
            style={{
              background: name.trim() && selectedRole ? "#0f0f0e" : "#e5e7eb",
              color: name.trim() && selectedRole ? "#ffffff" : "#9ca3af",
              cursor: name.trim() && selectedRole ? "pointer" : "not-allowed",
            }}
          >
            Vào hệ thống
            <ChevronRight size={15} strokeWidth={2} />
          </button>

          <div className="mt-4 text-center text-[11px] text-[#9ca3af]">
            Avanti Hotel Management System · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
