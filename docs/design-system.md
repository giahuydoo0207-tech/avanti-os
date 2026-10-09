# Avanti OS: hệ thống giao diện

Tài liệu cho WBS 3.3 (Thiết kế giao diện & hệ thống component). Token nằm trong [`app/globals.css`](../app/globals.css), component dùng chung trong [`components/pms/ui.tsx`](../components/pms/ui.tsx).

## Nguyên tắc
- Một màu nhấn duy nhất: **đồng (bronze)** của thương hiệu Avanti. Dùng cho nút hành động chính, viền focus, mục đang chọn.
- Nền trung tính ấm. Không trộn xám lạnh với xám ấm.
- Màu trạng thái phòng giống nhau ở mọi màn hình (Tổng quan, Sơ đồ phòng, Room Plan, Availability).
- Chữ: **Be Vietnam Pro** (thiết kế cho tiếng Việt), số liệu dùng **JetBrains Mono** hoặc `tabular-nums` để các cột số thẳng hàng.
- Phẳng, không đổ bóng: tách lớp bằng viền mảnh và nền, mắt không mỏi khi nhìn cả ca trực.
- Chuyển động nhẹ (thư viện `motion`): overlay trượt lên, tab mờ dần, toast. Tự tắt khi hệ điều hành bật "giảm chuyển động".

## Token màu (Tailwind: `bg-*`, `text-*`, `border-*`)
| Nhóm | Token | Dùng cho |
|---|---|---|
| Bề mặt | `paper`, `surface`, `sunken`, `line`, `line-soft`, `line-strong` | Nền trang, thẻ, ô nhập, đường kẻ |
| Chữ | `ink`, `ink-2`, `muted`, `faint` | Chữ chính, phụ, ghi chú (đạt WCAG AA), placeholder |
| Thanh bên | `night`, `night-2`, `night-3`, `night-line`, `night-text`, `night-muted` | Sidebar, nút chính |
| Nhấn | `accent`, `accent-strong`, `accent-soft`, `accent-bright` | Nút "Đặt phòng mới", focus, mục đang chọn |
| Trống sạch | `clean`, `clean-soft`, `clean-line`, `clean-ink` | Phòng sẵn sàng bán, số dư = 0 |
| Có khách | `occ`, `occ-soft`, `occ-line`, `occ-ink` | Phòng đang ở, đặt phòng "Đang ở" |
| Chờ dọn | `dirty`, `dirty-soft`, `dirty-line`, `dirty-ink` | Phòng bẩn, lỗi, còn nợ |
| Hỏng | `ooo`, `ooo-soft`, `ooo-line`, `ooo-ink` | Phòng OOO, đã trả phòng |
| Khách đến | `arrive`, `arrive-soft`, `arrive-line`, `arrive-ink` | Đặt phòng Confirmed, nhãn "Đến" |

Bo góc: `rounded-ctl` (6px) cho nút và ô nhập, `rounded-card` (10px) cho thẻ.

## Component dùng chung (`components/pms/ui.tsx`)
`Card`, `SectionTitle`, `FieldRow`, `Stat`, `ErrorBox`, `EmptyRow`, `OverlayHeader`, `StatusDot`, `ResBadge`, các class `inputCls` / `selectCls` / `textareaCls`, và nút `.pms-btn-primary`, `.pms-btn-accent`, `.pms-btn-secondary`, `.pms-btn-danger` (trong `globals.css`).

## Khả năng truy cập
- Viền focus màu nhấn cho mọi phần tử bấm được (`:focus-visible`).
- Link "Bỏ qua tới nội dung", `aria-current` trên menu, `aria-pressed` trên bộ lọc, `aria-label` cho nút chỉ có biểu tượng.
- Thông báo (toast, "Đang lưu…", lỗi) dùng `aria-live` / `role="alert"`.

## Luồng màn hình
Sơ đồ luồng màn hình lễ tân vẽ trên Lucidchart: *Avanti OS - Luồng màn hình Lễ tân*.
