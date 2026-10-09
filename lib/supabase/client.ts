"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Next.js chỉ nhúng biến NEXT_PUBLIC_* khi được viết đúng tên như dưới đây
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true khi đã cấu hình Supabase; nếu không, ứng dụng chạy chế độ demo (localStorage) */
export const isSupabaseConfigured = Boolean(url && anonKey);
export const realtimeEnabled = process.env.NEXT_PUBLIC_SUPABASE_REALTIME !== "off";

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!client) client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export interface StaffProfile { userId: string; fullName: string; branchId: string; branchCode: string; branchName: string }

/** Hồ sơ lễ tân của tài khoản đang đăng nhập (null nếu chưa đăng nhập hoặc chưa được cấp quyền) */
export async function fetchStaffProfile(): Promise<StaffProfile | null> {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from("staff_profiles")
    .select("id, full_name, branch_id, is_active, branches(code, name)")
    .eq("id", session.user.id).maybeSingle();
  if (error || !data || !data.is_active) return null;
  const br = (Array.isArray(data.branches) ? data.branches[0] : data.branches) as { code: string; name: string } | null;
  return { userId: data.id, fullName: data.full_name, branchId: data.branch_id, branchCode: br?.code ?? "", branchName: br?.name ?? "" };
}
