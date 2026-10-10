# Avanti OS — ERD (Supabase)

Schema đầy đủ: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql). API nghiệp vụ: [`0002_rpc.sql`](../supabase/migrations/0002_rpc.sql), mô tả ở [api.md](api.md). Lịch sử sửa hồ sơ khách: bảng `guest_changes` ghi bằng trigger trong [`0003_guest_changes.sql`](../supabase/migrations/0003_guest_changes.sql).
Kiểu dữ liệu frontend tương ứng: [`lib/pms/types.ts`](../lib/pms/types.ts) (camelCase ↔ snake_case).

```mermaid
erDiagram
  AUTH_USERS ||--|| STAFF_PROFILES : "1 tài khoản = 1 lễ tân"
  BRANCHES ||--o{ STAFF_PROFILES : "có"
  BRANCHES ||--o{ ROOM_TYPES : "định nghĩa"
  BRANCHES ||--o{ ROOMS : "có"
  ROOM_TYPES ||--o{ ROOMS : "phân loại"
  BRANCHES ||--o{ GUESTS : "lưu hồ sơ"
  GUESTS ||--o{ RESERVATIONS : "đặt"
  ROOM_TYPES ||--o{ RESERVATIONS : "loại đã đặt"
  ROOMS |o--o{ RESERVATIONS : "gán phòng (có thể null)"
  RESERVATIONS ||--|| FOLIOS : "mở 1 folio"
  FOLIOS ||--o{ FOLIO_TRANSACTIONS : "ghi sổ"
  ROOMS ||--o{ HOUSEKEEPING_LOGS : "lịch sử dọn"
  BRANCHES ||--o{ SHIFT_REPORTS : "giao ca"
  SHIFT_REPORTS ||--o{ SHIFT_TASKS : "việc bàn giao"
  BRANCHES ||--o{ ACTIVITY_LOGS : "nhật ký"
  STAFF_PROFILES ||--o{ FOLIO_TRANSACTIONS : "post"
  STAFF_PROFILES ||--o{ SHIFT_REPORTS : "lập"

  BRANCHES {
    uuid id PK
    text code UK
    text name
    text address
    smallint stars
  }
  STAFF_PROFILES {
    uuid id PK "= auth.users.id"
    uuid branch_id FK
    text full_name
    text role "front_desk"
    bool is_active
  }
  ROOM_TYPES {
    uuid id PK
    uuid branch_id FK
    text code
    text name
    bigint base_rate
    smallint max_pax
  }
  ROOMS {
    uuid id PK
    uuid branch_id FK
    uuid room_type_id FK
    text number
    smallint floor
    text hk_status "clean|dirty|out_of_order"
  }
  GUESTS {
    uuid id PK
    uuid branch_id FK
    text guest_type
    text full_name
    char2 nationality
    text id_type
    text id_number
    text phone
    text company
    text visa_type "PC06"
  }
  RESERVATIONS {
    uuid id PK
    uuid branch_id FK
    text confirmation_no
    uuid guest_id FK
    uuid room_type_id FK
    uuid room_id FK "nullable"
    date arrival_date
    date departure_date
    bigint rate
    text status
    timestamptz checked_in_at
    timestamptz checked_out_at
  }
  FOLIOS {
    uuid id PK
    uuid branch_id FK
    uuid reservation_id FK,UK
    text folio_no
    text status "open|closed"
  }
  FOLIO_TRANSACTIONS {
    uuid id PK
    uuid folio_id FK
    date business_date
    text code
    text kind "debit|credit"
    bigint amount
    text payment_method
    bool voided
    uuid posted_by FK
  }
  HOUSEKEEPING_LOGS {
    uuid id PK
    uuid room_id FK
    text from_status
    text to_status
    uuid changed_by FK
  }
  SHIFT_REPORTS {
    uuid id PK
    uuid branch_id FK
    date business_date
    text shift
    uuid reporter_id FK
    bigint cash_balance
    text status
  }
  SHIFT_TASKS {
    uuid id PK
    uuid shift_report_id FK
    text content
    text priority
    bool done
  }
  ACTIVITY_LOGS {
    uuid id PK
    uuid branch_id FK
    uuid actor_id FK
    text action
    text message
  }
```

## Quy tắc nghiệp vụ nằm ở database

| Quy tắc | Cách đảm bảo |
|---|---|
| Không đặt trùng phòng trùng ngày | `exclude using gist (room_id, daterange)` cho trạng thái tentative/confirmed/checked_in |
| Mỗi đặt phòng có đúng 1 folio | `folios.reservation_id unique` |
| Giao dịch không bị xóa / sửa tiền | Không có policy update/delete; hủy bằng RPC `void_transaction` (lưu vết) |
| Check-in chỉ vào phòng sạch, tự post tiền phòng + VAT từng đêm | RPC `check_in` |
| Check-out khi số dư folio = 0, phòng chuyển "chờ dọn" | RPC `check_out` + view `folio_balances` |
| Lễ tân chỉ thấy dữ liệu chi nhánh mình | RLS theo `private.current_branch_id()` |

## Trạng thái đặt phòng

```
tentative ─┐
           ├─► confirmed ─► checked_in ─► checked_out
           └─► cancelled          └─(quá ngày)─► no_show
```
Trạng thái phòng hiển thị = `occupied` nếu có đặt phòng `checked_in`, ngược lại là `rooms.hk_status`.
