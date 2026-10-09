-- ════════════════════════════════════════════════════════════════════
-- Avanti OS — schema Supabase cho phân hệ Lễ tân
-- Khớp 1-1 với kiểu dữ liệu ở lib/pms/types.ts (camelCase ↔ snake_case)
-- Tiền: bigint (VND, không có phần lẻ). Ngày lưu trú: date. Mốc thời gian: timestamptz.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;  -- cho ràng buộc chống đặt trùng phòng
create schema if not exists private;

-- ─── Chi nhánh & nhân viên ──────────────────────────────────────────
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  address     text not null default '',
  stars       smallint not null default 3 check (stars between 1 and 5),
  created_at  timestamptz not null default now()
);

-- Mỗi tài khoản Supabase Auth = một nhân viên lễ tân của một chi nhánh
create table public.staff_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  branch_id   uuid not null references public.branches (id),
  full_name   text not null,
  role        text not null default 'front_desk' check (role = 'front_desk'), -- hệ thống chỉ có vai trò Lễ tân
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index staff_profiles_branch_id_idx on public.staff_profiles (branch_id);

-- ─── Phòng ──────────────────────────────────────────────────────────
create table public.room_types (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches (id),
  code        text not null,
  name        text not null,
  base_rate   bigint not null check (base_rate > 0),
  max_pax     smallint not null check (max_pax > 0),
  unique (branch_id, code)
);

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches (id),
  room_type_id  uuid not null references public.room_types (id),
  number        text not null,
  floor         smallint not null,
  hk_status     text not null default 'clean' check (hk_status in ('clean', 'dirty', 'out_of_order')),
  updated_at    timestamptz not null default now(),
  unique (branch_id, number)
);
create index rooms_room_type_id_idx on public.rooms (room_type_id);

-- ─── Khách ──────────────────────────────────────────────────────────
create table public.guests (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches (id),
  guest_type       text not null check (guest_type in ('vietnamese', 'foreign')),
  full_name        text not null check (length(trim(full_name)) > 0),
  nationality      char(2) not null default 'VN',
  id_type          text not null check (id_type in ('cccd', 'passport')),
  id_number        text not null default '',
  id_issued_date   date,
  id_issued_place  text not null default '',
  id_expiry_date   date,
  dob              date,
  gender           text check (gender in ('male', 'female', 'other')),
  phone            text not null default '',
  email            text not null default '',
  address          text not null default '',
  company          text not null default '',
  -- Khai báo tạm trú PC06 (khách nước ngoài)
  visa_type        text not null default '',
  visa_number      text not null default '',
  visa_expiry      date,
  entry_date       date,
  port_of_entry    text not null default '',
  created_at       timestamptz not null default now()
);
create index guests_branch_id_idx on public.guests (branch_id);
create index guests_id_number_idx on public.guests (branch_id, id_number) where id_number <> '';

-- ─── Đặt phòng ──────────────────────────────────────────────────────
create table public.reservations (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches (id),
  confirmation_no  text not null,
  guest_id         uuid not null references public.guests (id),
  room_type_id     uuid not null references public.room_types (id),
  room_id          uuid references public.rooms (id),           -- null = chưa gán phòng (waiting list)
  arrival_date     date not null,
  departure_date   date not null,
  adults           smallint not null default 1 check (adults >= 1),
  children         smallint not null default 0 check (children >= 0),
  rate             bigint not null check (rate > 0),             -- giá / đêm
  meal_plan        text not null default 'RO' check (meal_plan in ('RO', 'BB', 'HB', 'FB')),
  source           text not null default 'Direct',
  status           text not null default 'confirmed'
                   check (status in ('tentative', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  note             text not null default '',
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  created_by       uuid references public.staff_profiles (id),
  created_at       timestamptz not null default now(),
  unique (branch_id, confirmation_no),
  check (departure_date > arrival_date),
  check (status <> 'checked_in' or (room_id is not null and checked_in_at is not null)),
  -- Một phòng không thể có 2 đặt phòng còn hiệu lực chồng ngày (cũng đảm bảo mỗi phòng chỉ 1 khách đang ở)
  constraint reservations_no_overlap exclude using gist (
    room_id with =,
    daterange(arrival_date, departure_date, '[)') with &&
  ) where (room_id is not null and status in ('tentative', 'confirmed', 'checked_in'))
);
create index reservations_guest_id_idx      on public.reservations (guest_id);
create index reservations_room_type_id_idx  on public.reservations (room_type_id);
create index reservations_room_id_idx       on public.reservations (room_id);
create index reservations_arrival_idx       on public.reservations (branch_id, arrival_date);
create index reservations_departure_idx     on public.reservations (branch_id, departure_date);
create index reservations_in_house_idx      on public.reservations (branch_id, room_id) where status = 'checked_in';

-- ─── Folio & giao dịch ──────────────────────────────────────────────
create table public.folios (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches (id),
  reservation_id  uuid not null unique references public.reservations (id),
  folio_no        text not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  unique (branch_id, folio_no)
);

-- Giao dịch không bao giờ bị xóa/sửa số tiền; muốn hủy thì "void" (lưu vết)
create table public.folio_transactions (
  id              uuid primary key default gen_random_uuid(),
  folio_id        uuid not null references public.folios (id),
  business_date   date not null,
  posted_at       timestamptz not null default now(),
  code            text not null check (code in ('ROOM','TAX','MINIBAR','LAUNDRY','RESTAURANT','TRANSPORT','SPA','MISC','DEPOSIT','PAYMENT','DISCOUNT')),
  kind            text not null check (kind in ('debit', 'credit')),
  description     text not null,
  amount          bigint not null check (amount > 0),
  payment_method  text check (payment_method in ('cash_vnd', 'cash_usd', 'card', 'bank_transfer', 'city_ledger')),
  ref             text not null default '',
  voided          boolean not null default false,
  voided_at       timestamptz,
  posted_by       uuid references public.staff_profiles (id),
  check ((code in ('DEPOSIT','PAYMENT','DISCOUNT')) = (kind = 'credit')),
  check (code not in ('DEPOSIT','PAYMENT') or payment_method is not null)
);
create index folio_transactions_folio_id_idx on public.folio_transactions (folio_id);
create index folio_transactions_posted_at_idx on public.folio_transactions (posted_at);

-- Số dư folio (debit - credit, bỏ giao dịch đã void)
create view public.folio_balances with (security_invoker = true) as
select f.id as folio_id,
       f.branch_id,
       coalesce(sum(t.amount) filter (where t.kind = 'debit'  and not t.voided), 0) as total_debit,
       coalesce(sum(t.amount) filter (where t.kind = 'credit' and not t.voided), 0) as total_credit,
       coalesce(sum(case when t.voided then 0 when t.kind = 'debit' then t.amount else -t.amount end), 0) as balance
from public.folios f
left join public.folio_transactions t on t.folio_id = f.id
group by f.id, f.branch_id;

-- ─── Buồng phòng, giao ca, nhật ký ─────────────────────────────────
create table public.housekeeping_logs (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id),
  from_status  text not null,
  to_status    text not null,
  changed_by   uuid references public.staff_profiles (id),
  changed_at   timestamptz not null default now()
);
create index housekeeping_logs_room_id_idx on public.housekeeping_logs (room_id);

create table public.shift_reports (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches (id),
  business_date      date not null,
  shift              text not null check (shift in ('morning', 'afternoon', 'night')),
  reporter_id        uuid not null references public.staff_profiles (id),
  handover_to_name   text not null,
  cash_balance       bigint not null default 0,
  general_note       text not null default '',
  incident_note      text not null default '',
  status             text not null default 'submitted' check (status in ('submitted', 'confirmed')),
  confirmed_by       uuid references public.staff_profiles (id),
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index shift_reports_branch_date_idx on public.shift_reports (branch_id, business_date desc);

create table public.shift_tasks (
  id               uuid primary key default gen_random_uuid(),
  shift_report_id  uuid not null references public.shift_reports (id) on delete cascade,
  content          text not null,
  priority         text not null default 'normal' check (priority in ('urgent', 'normal', 'info')),
  done             boolean not null default false
);
create index shift_tasks_report_id_idx on public.shift_tasks (shift_report_id);

create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches (id),
  actor_id     uuid references public.staff_profiles (id),
  action       text not null,
  entity_type  text not null check (entity_type in ('reservation', 'room', 'folio', 'shift_report')),
  entity_id    uuid,
  message      text not null,
  created_at   timestamptz not null default now()
);
create index activity_logs_branch_created_idx on public.activity_logs (branch_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security: nhân viên chỉ thấy dữ liệu chi nhánh của mình
-- ════════════════════════════════════════════════════════════════════
create or replace function private.current_branch_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select branch_id from public.staff_profiles where id = (select auth.uid()) and is_active
$$;
revoke execute on function private.current_branch_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_branch_id() to authenticated;

alter table public.branches            enable row level security;
alter table public.staff_profiles      enable row level security;
alter table public.room_types          enable row level security;
alter table public.rooms               enable row level security;
alter table public.guests              enable row level security;
alter table public.reservations        enable row level security;
alter table public.folios              enable row level security;
alter table public.folio_transactions  enable row level security;
alter table public.housekeeping_logs   enable row level security;
alter table public.shift_reports       enable row level security;
alter table public.shift_tasks         enable row level security;
alter table public.activity_logs       enable row level security;

create policy branches_read on public.branches for select to authenticated using (id = (select private.current_branch_id()));
create policy staff_read on public.staff_profiles for select to authenticated using (branch_id = (select private.current_branch_id()));
create policy room_types_read on public.room_types for select to authenticated using (branch_id = (select private.current_branch_id()));

create policy rooms_read   on public.rooms for select to authenticated using (branch_id = (select private.current_branch_id()));
create policy rooms_update on public.rooms for update to authenticated using (branch_id = (select private.current_branch_id())) with check (branch_id = (select private.current_branch_id()));

create policy guests_all on public.guests for all to authenticated
  using (branch_id = (select private.current_branch_id())) with check (branch_id = (select private.current_branch_id()));
create policy reservations_all on public.reservations for all to authenticated
  using (branch_id = (select private.current_branch_id())) with check (branch_id = (select private.current_branch_id()));
create policy folios_all on public.folios for all to authenticated
  using (branch_id = (select private.current_branch_id())) with check (branch_id = (select private.current_branch_id()));

-- Giao dịch: chỉ đọc & thêm mới qua client; void làm qua RPC (không có policy update/delete)
create policy folio_txn_read on public.folio_transactions for select to authenticated
  using (exists (select 1 from public.folios f where f.id = folio_id and f.branch_id = (select private.current_branch_id())));
create policy folio_txn_insert on public.folio_transactions for insert to authenticated
  with check (exists (select 1 from public.folios f where f.id = folio_id and f.status = 'open' and f.branch_id = (select private.current_branch_id())));

create policy hk_logs_rw on public.housekeeping_logs for all to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_id and r.branch_id = (select private.current_branch_id())))
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.branch_id = (select private.current_branch_id())));
create policy shift_reports_all on public.shift_reports for all to authenticated
  using (branch_id = (select private.current_branch_id())) with check (branch_id = (select private.current_branch_id()));
create policy shift_tasks_all on public.shift_tasks for all to authenticated
  using (exists (select 1 from public.shift_reports s where s.id = shift_report_id and s.branch_id = (select private.current_branch_id())))
  with check (exists (select 1 from public.shift_reports s where s.id = shift_report_id and s.branch_id = (select private.current_branch_id())));
create policy activity_read on public.activity_logs for select to authenticated using (branch_id = (select private.current_branch_id()));
create policy activity_insert on public.activity_logs for insert to authenticated with check (branch_id = (select private.current_branch_id()));

-- ════════════════════════════════════════════════════════════════════
-- Thao tác nhiều bước chạy trong 1 transaction (tương ứng actions trong lib/pms/store.tsx)
-- ════════════════════════════════════════════════════════════════════

-- Check-in: kiểm tra phòng sạch, post tiền phòng + VAT từng đêm, chuyển trạng thái
create or replace function public.check_in(p_reservation_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  r public.reservations;
  v_folio uuid;
  v_room public.rooms;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_night date;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.id is null then raise exception 'Không tìm thấy đặt phòng'; end if;
  if r.status not in ('tentative', 'confirmed') then raise exception 'Đặt phòng không ở trạng thái chờ nhận phòng'; end if;
  if r.arrival_date > v_today then raise exception 'Chưa tới ngày đến'; end if;
  if r.room_id is null then raise exception 'Chưa gán phòng'; end if;
  select * into v_room from public.rooms where id = r.room_id for update;
  if v_room.hk_status <> 'clean' then raise exception 'Phòng % chưa sẵn sàng (%)', v_room.number, v_room.hk_status; end if;
  select id into v_folio from public.folios where reservation_id = r.id;
  for v_night in select generate_series(greatest(r.arrival_date, v_today), r.departure_date - 1, interval '1 day')::date loop
    insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, ref, posted_by)
    values (v_folio, v_night, 'ROOM', 'debit', 'Tiền phòng đêm ' || to_char(v_night, 'DD/MM'), r.rate, v_room.number, (select auth.uid())),
           (v_folio, v_night, 'TAX',  'debit', 'VAT 8%', round(r.rate * 0.08), 'AUTO', (select auth.uid()));
  end loop;
  update public.reservations set status = 'checked_in', checked_in_at = now(), arrival_date = greatest(arrival_date, v_today) where id = r.id;
end $$;

-- Check-out: yêu cầu số dư folio = 0, đóng folio, phòng chuyển "dirty"
create or replace function public.check_out(p_reservation_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  r public.reservations;
  v_balance bigint;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.status <> 'checked_in' then raise exception 'Khách không ở trạng thái đang ở'; end if;
  select b.balance into v_balance from public.folio_balances b join public.folios f on f.id = b.folio_id where f.reservation_id = r.id;
  if v_balance <> 0 then raise exception 'Folio còn số dư % — thu tiền trước khi trả phòng', v_balance; end if;
  update public.reservations set status = 'checked_out', checked_out_at = now() where id = r.id;
  update public.folios set status = 'closed', closed_at = now() where reservation_id = r.id;
  insert into public.housekeeping_logs (room_id, from_status, to_status, changed_by)
    select id, hk_status, 'dirty', (select auth.uid()) from public.rooms where id = r.room_id;
  update public.rooms set hk_status = 'dirty', updated_at = now() where id = r.room_id;
end $$;

-- Void giao dịch (giữ lại dòng, đánh dấu voided)
create or replace function public.void_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.folio_transactions t set voided = true, voided_at = now()
  from public.folios f
  where t.id = p_transaction_id and f.id = t.folio_id and f.status = 'open' and not t.voided
    and f.branch_id = (select private.current_branch_id());
  if not found then raise exception 'Không void được giao dịch này'; end if;
end $$;
revoke execute on function public.void_transaction(uuid) from public, anon;
grant execute on function public.void_transaction(uuid) to authenticated;
revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
revoke execute on function public.check_out(uuid) from public, anon;
grant execute on function public.check_out(uuid) to authenticated;
