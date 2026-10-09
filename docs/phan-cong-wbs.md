# Avanti OS — WBS và phân công theo file

Dự án: **Avanti OS — phân hệ Lễ tân** (web quản lý khách sạn, Next.js + Supabase). Nhóm 4 người, 10–12 tuần.

| Vai trò | Người | Phụ trách WBS |
|---|---|---|
| PM kiêm BA | Đỗ Gia Huy | 1.0, 2.0, 7.2 |
| Frontend Developer | Thành viên 2 | 3.3, 5.0 |
| Backend Developer | Thành viên 3 | 3.1, 3.2, 4.0, 7.1 |
| Tester (QA) | Thành viên 4 | 6.0 |

Cột **File bàn giao** là thứ đính kèm vào task tương ứng trên ClickUp.

## 1.0 Quản lý dự án — PM
| Mã | Work package | File bàn giao |
|---|---|---|
| 1.1 | Kế hoạch dự án | Báo cáo mục 1–5, file `.pod` ProjectLibre |
| 1.2 | Báo cáo tiến độ hằng tuần | Ảnh board ClickUp theo tuần |
| 1.3 | Báo cáo tổng kết | Báo cáo cuối kỳ, slide |

## 2.0 Phân tích yêu cầu — PM/BA
| Mã | Work package | File bàn giao |
|---|---|---|
| 2.1 | Đặc tả nghiệp vụ lễ tân | Quy trình đặt phòng → check-in → folio → check-out → dọn phòng → giao ca (README.md) |
| 2.2 | Báo cáo đánh giá prototype | Danh sách điểm thiếu của bản cũ (8 tab rời nhau, số liệu lệch, đăng nhập giả) |

## 3.0 Thiết kế
| Mã | Work package | Người | File bàn giao |
|---|---|---|---|
| 3.1 | ERD & từ điển dữ liệu | Backend | `docs/erd.md` |
| 3.2 | Đặc tả API | Backend | `docs/api.md` |
| 3.3 | Thiết kế giao diện & hệ thống component | Frontend | `docs/design-system.md`, `components/pms/ui.tsx`, `app/globals.css`, sơ đồ luồng màn hình (Lucidchart) |

## 4.0 Phát triển Backend — Backend
| Mã | Work package | File bàn giao | Nội dung chính |
|---|---|---|---|
| 4.1 | Cơ sở dữ liệu | `supabase/migrations/0001_init.sql` (phần bảng) | 12 bảng, ràng buộc chống đặt trùng phòng (exclusion constraint), view số dư folio |
| 4.2 | Xác thực & phân quyền | `0001_init.sql` (phần RLS), `lib/supabase/client.ts` | Supabase Auth, RLS theo chi nhánh |
| 4.3 | API đặt phòng & gán phòng | `0002_rpc.sql` (mục 4.3) | create/assign/move/cancel reservation |
| 4.4 | API lưu trú & folio | `0002_rpc.sql` (mục 4.4) | check-in, post/void giao dịch, check-out |
| 4.5 | API buồng phòng & giao ca | `0002_rpc.sql` (mục 4.5) | trạng thái phòng, báo cáo giao ca |
| 4.6 | Dữ liệu mẫu | `scripts/seed-supabase.ts` | 2 chi nhánh, 147 phòng, ~400 đặt phòng, 3 tài khoản lễ tân |
| 4.7 | Lớp kết nối dữ liệu | `lib/pms/backend/supabase.ts` | Đọc bảng, gọi RPC, Realtime giữa nhiều quầy |

## 5.0 Phát triển Frontend — Frontend
| Mã | Work package | File bàn giao |
|---|---|---|
| 5.1 | Đăng nhập & khung ứng dụng | `app/page.tsx`, `app/dashboard/page.tsx`, `app/layout.tsx`, `components/pms/nav.tsx` |
| 5.2 | Tổng quan & sơ đồ phòng | `components/pms/tabs/overview.tsx`, `room-map.tsx` |
| 5.3 | Đặt phòng, tìm kiếm & Room Plan | `tabs/reservation.tsx`, `search.tsx`, `room-plan.tsx`, `components/pms/guest-form.tsx` |
| 5.4 | Check-in / Check-out & folio | `components/pms/overlays.tsx`, `folio.tsx` |
| 5.5 | Thu ngân, Availability & giao ca | `tabs/cashier.tsx`, `availability.tsx`, `shift-report.tsx` |
| 5.6 | Kho dữ liệu chung & chế độ demo | `lib/pms/store.tsx`, `selectors.ts`, `format.ts`, `types.ts`, `seed.ts`, `backend/local.ts`, `backend/types.ts` |

## 6.0 Kiểm thử — Tester
| Mã | Work package | File bàn giao |
|---|---|---|
| 6.1 | Kế hoạch & ca kiểm thử | Bảng ca kiểm thử (luồng chính + luật chặn: phòng bẩn, trùng lịch, folio còn nợ, khác chi nhánh) |
| 6.2 | Báo cáo kiểm thử | Kết quả chạy, ảnh chụp lỗi/đạt |

## 7.0 Triển khai
| Mã | Work package | Người | File bàn giao |
|---|---|---|---|
| 7.1 | Môi trường production | Backend | Project Supabase + Vercel, `.env.example` |
| 7.2 | Hướng dẫn sử dụng & bàn giao | PM | `README.md`, tài khoản demo |

## Chuỗi phụ thuộc chính (gợi ý đường găng)
2.1 → 3.1 → 4.1 → 4.2 → 4.3 → 4.4 → 4.7 → 5.4 → 6.2 → 7.1

Frontend 5.1–5.3 chạy song song với backend 4.1–4.5 nhờ chế độ demo (`backend/local.ts`), rồi nối vào API ở 4.7.
