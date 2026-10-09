# Avanti OS — phân hệ Lễ tân

Web quản lý khách sạn (PMS) cho Avanti Hotel và Avanti Boutique. Một vai trò duy nhất: **Lễ tân**.
Next.js 16 + Supabase (Postgres, Auth, RLS, RPC, Realtime).

Luồng nghiệp vụ liên thông: **Đặt phòng → Check-in → Folio / Thu ngân → Check-out → Dọn phòng → Giao ca**.
Mọi màn hình (Tổng quan, Sơ đồ phòng, Room Plan, Availability, Báo cáo) đọc cùng một nguồn dữ liệu nên luôn khớp nhau.

## Chạy nhanh (chế độ demo, không cần Supabase)
```bash
npm install
npm run dev        # http://localhost:3000 — nhập tên bất kỳ để vào
```

## Chạy với Supabase thật
1. Tạo project tại supabase.com (region Singapore).
2. **SQL Editor** → chạy lần lượt `supabase/migrations/0001_init.sql` rồi `0002_rpc.sql`.
3. **Project Settings → API**: sao chép `.env.example` thành `.env.local`, điền URL, `anon` key và `service_role` key (dùng mục *Legacy API keys* nếu có).
4. Nạp dữ liệu mẫu và tạo tài khoản lễ tân:
   ```bash
   npm run seed:supabase
   ```
5. `npm run dev`, đăng nhập (chọn đúng chi nhánh ở cột trái), mật khẩu `Avanti@2026`:
   | Email | Lễ tân | Chi nhánh |
   |---|---|---|
   | letan.avanti@avanti-demo.vn | Nguyễn Thị Hoa | Avanti Hotel |
   | letan2.avanti@avanti-demo.vn | Trần Văn Minh | Avanti Hotel |
   | letan.boutique@avanti-demo.vn | Lê Hoàng Anh | Avanti Boutique |
6. Vercel: thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào Environment Variables rồi redeploy. Không đưa `service_role` lên Vercel.

Mở 2 trình duyệt với 2 tài khoản Avanti Hotel để thấy hai quầy lễ tân cùng cập nhật (Realtime).

## Cấu trúc
```
FRONTEND
app/                    Trang đăng nhập, khung dashboard
components/pms/         8 tab + overlay Check-in / Check-out / Folio
lib/pms/store.tsx       Kho dữ liệu chung, chọn backend demo hoặc Supabase
lib/pms/backend/local.ts  Chế độ demo (localStorage), cùng luật nghiệp vụ với RPC

BACKEND
supabase/migrations/0001_init.sql  12 bảng, ràng buộc, RLS theo chi nhánh
supabase/migrations/0002_rpc.sql   12 API nghiệp vụ (RPC)
scripts/seed-supabase.ts           Dữ liệu mẫu + tài khoản
lib/pms/backend/supabase.ts        Đọc bảng, gọi RPC, Realtime
```

Tài liệu: [Giao diện](docs/design-system.md) · [ERD](docs/erd.md) · [API](docs/api.md) · [WBS & phân công](docs/phan-cong-wbs.md)
