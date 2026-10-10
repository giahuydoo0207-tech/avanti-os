"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ConciergeBell, Eye, EyeOff, Lock, User } from "lucide-react";
import { BranchPicker } from "@/components/branch-picker";
import { LoginScene } from "@/components/login-scene";
import { isValidPin, PIN_LENGTH, usernameToEmail } from "@/lib/pms/staff-login";
import { fetchStaffProfile, getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AvantiLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("avanti");
  const [showPw, setShowPw] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = isSupabaseConfigured ? Boolean(username.trim()) && isValidPin(pin) && !busy : Boolean(name.trim());

  // Đăng nhập thật bằng Supabase Auth; chi nhánh phải khớp với hồ sơ lễ tân của tài khoản
  const handleSupabaseLogin = async () => {
    if (!username.trim()) { setError("Nhập tên đăng nhập"); return; }
    if (!isValidPin(pin)) { setError(`Mã PIN gồm ${PIN_LENGTH} chữ số`); return; }
    setBusy(true); setError("");
    const sb = getSupabase();
    const { error: authError } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password: pin });
    if (authError) { setBusy(false); setError(authError.message === "Invalid login credentials" ? "Sai tên đăng nhập hoặc mã PIN" : authError.message); return; }
    const profile = await fetchStaffProfile();
    if (!profile) { await sb.auth.signOut(); setBusy(false); setError("Tài khoản chưa được cấp quyền lễ tân"); return; }
    if (profile.branchCode.toLowerCase() !== selectedBranch) {
      await sb.auth.signOut(); setBusy(false);
      setError(`Tài khoản này thuộc chi nhánh ${profile.branchName}, hãy chọn đúng chi nhánh bên trái`); return;
    }
    router.push("/dashboard");
  };

  const handleLogin = () => {
    if (isSupabaseConfigured) { void handleSupabaseLogin(); return; }
    if (!name.trim()) { setError("Vui lòng nhập họ và tên"); return; }
    setError("");
    if(typeof window!=="undefined"){
      localStorage.setItem("staffName", name.trim());
      localStorage.setItem("staffRole", "front_desk");
      localStorage.setItem("branchId", selectedBranch === "boutique" ? "br-boutique" : "br-avanti");
    }
    router.push("/dashboard");
  };

  const BRANCHES = [
    { id: "avanti", name: "Avanti Hotel", addr: "Quận 1, TP.HCM", rooms: 105, stars: 4 },
    { id: "boutique", name: "Avanti Boutique", addr: "Quận 3, TP.HCM", rooms: 42, stars: 3 },
  ];
  const fieldCls = "flex items-center gap-3 bg-surface border border-line rounded-ctl px-3.5 py-2.5 hover:border-line-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 transition-[border-color,box-shadow]";
  const inputCls = "flex-1 min-w-0 text-[14px] outline-none bg-transparent placeholder:text-faint font-medium text-ink";
  const labelCls = "block text-[12px] font-medium text-ink-2 mb-1.5";

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Cột trái: thương hiệu và chọn chi nhánh */}
      <aside className="hidden lg:flex flex-col w-[440px] shrink-0 bg-night text-white px-10 py-10 h-screen sticky top-0">
        <div>
          <div className="text-[20px] font-semibold tracking-tight leading-none">Avanti OS</div>
          <div className="text-[12px] text-night-muted mt-1.5">Hệ thống quản lý khách sạn</div>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center py-6">
          <LoginScene />
        </div>

        <div>
          <div className="text-[12px] text-night-muted mb-2.5">Chi nhánh làm việc</div>
          <BranchPicker branches={BRANCHES} value={selectedBranch} onChange={id => { setSelectedBranch(id); setError(""); }} />
          <div className="mt-8 text-[11px] text-night-muted mono">v6.081 · Build 2026</div>
        </div>
      </aside>

      {/* Cột phải: form đăng nhập */}
      <main className="flex-1 min-w-0 flex items-center justify-center px-4 sm:px-6 py-12">
        <form className="w-full min-w-0 max-w-[400px]" onSubmit={e => { e.preventDefault(); handleLogin(); }} noValidate>
          <div className="lg:hidden mb-8 text-[20px] font-semibold tracking-tight text-ink">Avanti OS</div>

          <div className="mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Đăng nhập ca trực</h1>
            <p className="text-[13px] text-muted mt-1" suppressHydrationWarning>
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
          </div>

          {/* Chọn chi nhánh trên màn hình nhỏ */}
          <div className="lg:hidden mb-5">
            <label htmlFor="branch-select" className={labelCls}>Chi nhánh</label>
            <select id="branch-select" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`${fieldCls} w-full text-[14px] font-medium`}>
              {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {isSupabaseConfigured ? (<>
            <div className="mb-4">
              <label htmlFor="login-username" className={labelCls}>Tên đăng nhập</label>
              <div className={fieldCls}>
                <User size={16} strokeWidth={1.75} className="text-faint shrink-0" aria-hidden="true" />
                <input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} className={inputCls}
                  placeholder="vd: hoa" value={username} onChange={e => { setUsername(e.target.value); setError(""); }} />
              </div>
            </div>
            <div className="mb-6">
              <label htmlFor="login-pin" className={labelCls}>Mã PIN <span className="font-normal text-muted">({PIN_LENGTH} số)</span></label>
              <div className={fieldCls}>
                <Lock size={16} strokeWidth={1.75} className="text-faint shrink-0" aria-hidden="true" />
                <input id="login-pin" name="pin" type={showPw ? "text" : "password"} inputMode="numeric" pattern="[0-9]*" maxLength={PIN_LENGTH} autoComplete="current-password" className={`${inputCls} mono tracking-[0.4em]`}
                  placeholder="••••••" value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH)); setError(""); }} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Ẩn mã PIN" : "Hiện mã PIN"} className="text-faint hover:text-ink-2 transition-colors rounded">
                  {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
            </div>
          </>) : (
            <div className="mb-6">
              <label htmlFor="login-name" className={labelCls}>Họ và tên nhân viên</label>
              <div className={fieldCls}>
                <User size={16} strokeWidth={1.75} className="text-faint shrink-0" aria-hidden="true" />
                <input id="login-name" name="name" autoComplete="name" className={`${inputCls} uppercase tracking-wide`}
                  placeholder="NGUYỄN VĂN A" value={name} onChange={e => { setName(e.target.value.toUpperCase()); setError(""); }} />
              </div>
              <p className="text-[12px] text-muted mt-1.5">Chế độ demo: nhập tên bất kỳ để vào, dữ liệu lưu trên trình duyệt này.</p>
            </div>
          )}

          <div className="mb-6 flex items-center gap-3 px-3.5 py-3 rounded-ctl bg-accent-soft/60 border border-accent/15">
            <div aria-hidden="true" className="w-8 h-8 rounded-ctl flex items-center justify-center shrink-0 bg-surface border border-accent/20 text-accent"><ConciergeBell size={16} strokeWidth={1.75} /></div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">Lễ tân <span className="font-normal text-muted">· Front Desk</span></div>
              <div className="text-[12px] text-ink-2 truncate">Đặt phòng, check-in/out, folio & thu ngân, sơ đồ phòng, giao ca</div>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-4 px-3.5 py-2.5 rounded-ctl bg-dirty-soft border border-dirty-line text-[13px] text-dirty-ink">{error}</div>
          )}

          <button type="submit" disabled={busy} aria-disabled={!canSubmit} className="pms-btn-primary w-full py-3 text-[14px]">
            {busy ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />Đang đăng nhập…</> : <>Vào hệ thống <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></>}
          </button>

          <p className="mt-5 text-center text-[12px] text-muted">
            Avanti OS · {new Date().getFullYear()}{isSupabaseConfigured ? "" : " · Chế độ demo"}
          </p>
        </form>
      </main>
    </div>
  );
}
