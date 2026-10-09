# Avanti OS — Hợp đồng API (Supabase RPC)

Frontend gọi `supabase.rpc("<tên>", { ...tham số })`. Mã nguồn: [`supabase/migrations/0002_rpc.sql`](../supabase/migrations/0002_rpc.sql).
Phía frontend bọc các lời gọi này trong [`lib/pms/backend/supabase.ts`](../lib/pms/backend/supabase.ts).

Quy ước chung:
- Mọi hàm yêu cầu đăng nhập (role `authenticated`) và có hồ sơ trong `staff_profiles`; chi nhánh lấy từ hồ sơ, client **không** gửi `branch_id`.
- Lỗi nghiệp vụ trả về HTTP 400, `error.message` là câu tiếng Việt hiển thị thẳng cho lễ tân.
- Mỗi thao tác thành công ghi một dòng `activity_logs` (hiện ở "Hoạt động gần đây").
- Tiền là số nguyên VND. Ngày là `YYYY-MM-DD` theo giờ Việt Nam.

## Đọc dữ liệu
Đọc trực tiếp các bảng bằng `supabase.from(table).select()`; RLS tự lọc theo chi nhánh. View `folio_balances` cho tổng debit/credit/số dư từng folio.

## Đặt phòng & gán phòng (WBS 4.3)

| RPC | Tham số | Trả về | Kiểm tra |
|---|---|---|---|
| `create_reservation` | `p` (jsonb): `guest_id` hoặc `guest{...}`, `room_type_id`, `room_id?`, `arrival_date`, `departure_date`, `adults`, `children`, `rate`, `meal_plan`, `source`, `status` (confirmed/tentative), `note`, `deposit_amount?`, `deposit_method?` | `uuid` đặt phòng | Ngày đến ≥ hôm nay, ≥1 đêm, số khách ≤ sức chứa +1, phòng không hỏng & không trùng lịch. Tự tạo khách mới, folio, giao dịch cọc |
| `assign_room` | `p_reservation_id`, `p_room_id` (null = bỏ gán) | — | Chỉ đặt phòng chưa nhận phòng; phòng không trùng lịch |
| `move_reservation` | `p_reservation_id`, `p_room_id`, `p_arrival` | — | Kéo-thả Room Plan; giữ nguyên số đêm, không dời về quá khứ |
| `cancel_reservation` | `p_reservation_id` | — | Chưa nhận phòng, folio không còn tiền cọc |

## Lưu trú & folio (WBS 4.4)

| RPC | Tham số | Trả về | Kiểm tra / tác động |
|---|---|---|---|
| `check_in` | `p_reservation_id`, `p_deposit_amount` (0), `p_deposit_method` | — | Đã tới ngày đến, đã gán phòng, phòng **sạch** và trống. Post tiền phòng + VAT 8% từng đêm, ghi cọc |
| `post_transaction` | `p_folio_id`, `p_code`, `p_description`, `p_amount`, `p_payment_method?` | `uuid` giao dịch | Folio đang mở; DEPOSIT/PAYMENT bắt buộc hình thức thanh toán |
| `void_transaction` | `p_transaction_id` | — | Không xóa, chỉ đánh dấu `voided` (lưu vết) |
| `check_out` | `p_reservation_id`, `p_discount_percent`, `p_payment_method`, `p_payment_amount` | `{ "change": tiền thừa }` | Trả sớm: void tiền phòng các đêm chưa ở (giữ đêm đầu). Áp giảm giá, thu đủ tiền (city_ledger = ghi công nợ), số dư phải về 0. Đóng folio, phòng → `dirty` |

Mã giao dịch: debit `ROOM TAX MINIBAR LAUNDRY RESTAURANT TRANSPORT SPA MISC`, credit `DEPOSIT PAYMENT DISCOUNT`.
Hình thức thanh toán: `cash_vnd cash_usd card bank_transfer city_ledger`.

## Buồng phòng & giao ca (WBS 4.5)

| RPC | Tham số | Kiểm tra / tác động |
|---|---|---|
| `set_housekeeping` | `p_room_id`, `p_status` (clean/dirty/out_of_order) | Không báo hỏng phòng đang có khách; ghi `housekeeping_logs` |
| `submit_shift_report` | `p` (jsonb): `business_date`, `shift` (morning/afternoon/night), `handover_to_name`, `cash_balance`, `general_note`, `incident_note`, `tasks[{content, priority, done}]` | Trả về `uuid` báo cáo |
| `confirm_shift_report` | `p_report_id` | Người nhận ca xác nhận |
| `toggle_shift_task` | `p_task_id` | Đánh dấu xong / chưa xong việc bàn giao |

## Ví dụ

```ts
const { error } = await supabase.rpc("check_in", { p_reservation_id: id, p_deposit_amount: 500000, p_deposit_method: "cash_vnd" });
if (error) alert(error.message); // "Phòng 305 chưa dọn — đánh dấu đã dọn trước khi nhận phòng"
```
