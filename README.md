# Avanti OS — phân hệ Lễ tân

Hệ thống quản lý khách sạn (PMS) cho Avanti Hotel / Avanti Boutique. Chỉ có một vai trò: **Lễ tân (Front Desk)**.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Kiến trúc frontend (một mạch dữ liệu)

```
lib/pms/types.ts      Kiểu dữ liệu — khớp 1-1 với bảng Supabase
lib/pms/seed.ts       Dữ liệu demo (tên giả), sinh theo ngày hôm nay
lib/pms/store.tsx     Kho dữ liệu chung + mọi thao tác nghiệp vụ (đặt phòng, check-in, folio, check-out, dọn phòng, giao ca)
lib/pms/selectors.ts  Các phép tính dùng chung (thống kê, phòng trống, availability, số dư folio)
components/pms/       Tab, overlay Check-in / Check-out / Folio, form khách
app/dashboard/        Khung màn hình Lễ tân
```

Mọi tab đọc cùng một state, nên thao tác ở đâu cũng phản ánh ở mọi nơi:
Đặt phòng → Room Plan / Availability → Check-in (phòng: Có khách, post tiền phòng) → Folio / Thu ngân → Check-out (thu tiền, phòng: Chờ dọn) → Sơ đồ phòng: Đánh dấu đã dọn → Báo cáo giao ca tự tổng hợp số liệu.

Hiện state lưu ở `localStorage` (nút “Khôi phục dữ liệu demo” để làm lại từ đầu).

## Backend Supabase

- Schema + RLS + RPC: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
- ERD và quy tắc nghiệp vụ: [`docs/erd.md`](docs/erd.md)

Khi nối Supabase, thay phần thân từng action trong `lib/pms/store.tsx` bằng truy vấn / RPC tương ứng; giao diện không cần đổi.
