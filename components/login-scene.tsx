/** Hình động cột trái màn hình đăng nhập: lễ tân làm việc tại quầy, khách tới nhận thẻ phòng.
 *  Chuyển động bằng CSS (lớp .ls-* trong app/globals.css), tự dừng khi bật "giảm chuyển động". */
export function LoginScene() {
  return (
    <svg viewBox="0 0 320 290" className="w-full max-w-[340px] h-auto" role="img" aria-label="Lễ tân làm việc tại quầy và trao thẻ phòng cho khách">
      <rect x="96" y="18" width="80" height="22" rx="4" fill="#201d19" stroke="#34302a" strokeWidth="2" />
      <text x="136" y="33" textAnchor="middle" fontFamily="'Be Vietnam Pro', sans-serif" fontSize="10" fontWeight="700" letterSpacing="1.5" fill="#e2b35f">LỄ TÂN</text>

      {/* Lễ tân */}
      <g className="ls-head">
        <circle cx="120" cy="88" r="21" fill="#2b2722" />
        <circle cx="120" cy="96" r="18" fill="#c8956d" />
        <rect x="114" y="110" width="12" height="12" fill="#c8956d" />
      </g>
      <path d="M86 176q0-48 34-52q34 4 34 52z" fill="#8a5a1c" />
      <path d="M112 124l8 13 8-13z" fill="#f1e6d4" />

      {/* Khách đi vào */}
      <g className="ls-guest">
        <circle cx="252" cy="92" r="19" fill="#6f6a63" />
        <path d="M218 176q0-50 34-54q34 4 34 54z" fill="#45403a" />
        <rect x="282" y="134" width="22" height="34" rx="4" fill="#a39b91" />
        <rect x="289" y="128" width="8" height="8" rx="2" fill="none" stroke="#a39b91" strokeWidth="2" />
      </g>

      {/* Laptop và tay gõ phím */}
      <rect x="90" y="136" width="62" height="38" rx="3" fill="#34302a" />
      <circle className="ls-glow" cx="121" cy="155" r="4" fill="#e2b35f" />
      <circle className="ls-hand-l" cx="100" cy="174" r="6" fill="#c8956d" />
      <circle className="ls-hand-r" cx="142" cy="174" r="6" fill="#c8956d" />

      {/* Quầy */}
      <rect x="20" y="176" width="280" height="12" rx="3" fill="#d9a54a" />
      <rect x="28" y="188" width="264" height="88" fill="#2b2722" />
      <rect x="28" y="214" width="264" height="4" fill="#8a5a1c" />

      {/* Chuông */}
      <circle className="ls-ring" cx="196" cy="166" r="14" fill="none" stroke="#e2b35f" strokeWidth="2" opacity="0" />
      <path d="M186 174a10 10 0 0 1 20 0z" fill="#e2b35f" />
      <rect x="183" y="173" width="26" height="4" rx="2" fill="#8a5a1c" />
      <rect x="194" y="160" width="4" height="4" rx="1" fill="#e2b35f" />

      {/* Thẻ phòng trượt sang khách */}
      <g className="ls-card">
        <rect x="150" y="160" width="22" height="14" rx="2.5" fill="#e2b35f" />
        <rect x="150" y="160" width="22" height="4" rx="2" fill="#8a5a1c" />
      </g>
      <rect x="20" y="276" width="280" height="2" rx="1" fill="#34302a" />
    </svg>
  );
}
