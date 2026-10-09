// Đăng nhập lễ tân bằng "tên đăng nhập + mã PIN".
// Supabase Auth cần email, nên tên đăng nhập được đổi ngầm thành email nội bộ <tên>@avanti-demo.vn.
// Người dùng không bao giờ phải gõ email.

export const STAFF_LOGIN_DOMAIN = "avanti-demo.vn";

/** Mã PIN: đúng 6 chữ số (Supabase yêu cầu mật khẩu tối thiểu 6 ký tự) */
export const PIN_LENGTH = 6;

/** "Hoa", " hoa " → "hoa"; vẫn chấp nhận email đầy đủ nếu người dùng gõ */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, "");
}

export function usernameToEmail(input: string): string {
  const u = normalizeUsername(input);
  return u.includes("@") ? u : `${u}@${STAFF_LOGIN_DOMAIN}`;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Tài khoản lễ tân mẫu, dùng chung cho script seed và README */
export const DEMO_STAFF = [
  { username: "hoa", pin: "111111", fullName: "NGUYỄN THỊ HOA", branch: "br-avanti", branchName: "Avanti Hotel" },
  { username: "minh", pin: "222222", fullName: "TRẦN VĂN MINH", branch: "br-avanti", branchName: "Avanti Hotel" },
  { username: "anh", pin: "333333", fullName: "LÊ HOÀNG ANH", branch: "br-boutique", branchName: "Avanti Boutique" },
] as const;
