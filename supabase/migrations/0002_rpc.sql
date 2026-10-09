-- ════════════════════════════════════════════════════════════════════
-- Avanti OS — API nghiệp vụ (RPC) cho phân hệ Lễ tân
-- Frontend gọi qua supabase.rpc('<tên hàm>', {...}). Mỗi hàm chạy trong 1 transaction,
-- tự kiểm tra quyền theo chi nhánh của nhân viên đăng nhập và ghi nhật ký hoạt động.
-- Lỗi nghiệp vụ trả về bằng RAISE EXCEPTION với thông điệp tiếng Việt để hiển thị thẳng cho lễ tân.
-- Hợp đồng API chi tiết: docs/api.md
-- ════════════════════════════════════════════════════════════════════

create sequence if not exists public.confirmation_no_seq start 1100001;
create sequence if not exists public.folio_no_seq start 260001;

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant select on public.folio_balances to authenticated;
grant usage on all sequences in schema public to authenticated;
-- service_role (script nạp dữ liệu mẫu) — cần khi tắt "Automatically expose new tables" lúc tạo project
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ─── Hàm nội bộ ─────────────────────────────────────────────────────
create or replace function private.today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

-- Chi nhánh của nhân viên đang gọi; báo lỗi nếu chưa đăng nhập / chưa có hồ sơ lễ tân
create or replace function private.require_branch()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  select branch_id into v from public.staff_profiles where id = (select auth.uid()) and is_active;
  if v is null then raise exception 'Tài khoản chưa được cấp quyền lễ tân'; end if;
  return v;
end $$;

create or replace function private.log(p_action text, p_entity text, p_entity_id uuid, p_message text)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_logs (branch_id, actor_id, action, entity_type, entity_id, message)
  values (private.require_branch(), (select auth.uid()), p_action, p_entity, p_entity_id, p_message)
$$;

-- Số xác nhận của đặt phòng khác đang chiếm phòng trong khoảng ngày (null nếu trống)
create or replace function private.room_conflict(p_room uuid, p_arrival date, p_departure date, p_exclude uuid)
returns text language sql stable security definer set search_path = '' as $$
  select confirmation_no from public.reservations
  where room_id = p_room and id is distinct from p_exclude
    and status in ('tentative', 'confirmed', 'checked_in')
    and daterange(arrival_date, departure_date, '[)') && daterange(p_arrival, p_departure, '[)')
  limit 1
$$;

-- Định dạng tiền kiểu Việt Nam: 1.250.000
create or replace function private.vnd(p bigint)
returns text language sql immutable set search_path = '' as $$
  select replace(to_char(p, 'FM999,999,999,999'), ',', '.')
$$;

create or replace function private.guest_name(p_guest uuid)
returns text language sql stable security definer set search_path = '' as $$
  select full_name from public.guests where id = p_guest
$$;

-- Khóa đặt phòng để cập nhật, đồng thời kiểm tra cùng chi nhánh
create or replace function private.lock_reservation(p_id uuid)
returns public.reservations language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_id and branch_id = private.require_branch() for update;
  if r.id is null then raise exception 'Không tìm thấy đặt phòng'; end if;
  return r;
end $$;

-- Kiểm tra phòng hợp lệ để gán cho khoảng ngày
create or replace function private.check_room(p_room uuid, p_arrival date, p_departure date, p_exclude uuid)
returns public.rooms language plpgsql security definer set search_path = '' as $$
declare v public.rooms; c text;
begin
  select * into v from public.rooms where id = p_room and branch_id = private.require_branch();
  if v.id is null then raise exception 'Phòng không tồn tại'; end if;
  if v.hk_status = 'out_of_order' then raise exception 'Phòng % đang hỏng (OOO)', v.number; end if;
  c := private.room_conflict(p_room, p_arrival, p_departure, p_exclude);
  if c is not null then raise exception 'Phòng % đã có đặt phòng #% trùng ngày', v.number, c; end if;
  return v;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 4.3  Đặt phòng & gán phòng
-- ════════════════════════════════════════════════════════════════════

-- p: { guest_id? | guest{...}, room_type_id, room_id?, arrival_date, departure_date, adults, children,
--      rate, meal_plan, source, status, note, deposit_amount?, deposit_method? }
create or replace function public.create_reservation(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := private.require_branch();
  v_today date := private.today();
  v_guest uuid := nullif(p->>'guest_id', '')::uuid;
  v_rt public.room_types;
  v_room uuid := nullif(p->>'room_id', '')::uuid;
  v_arr date := (p->>'arrival_date')::date;
  v_dep date := (p->>'departure_date')::date;
  v_adults int := coalesce((p->>'adults')::int, 1);
  v_children int := coalesce((p->>'children')::int, 0);
  v_rate bigint := round((p->>'rate')::numeric);
  v_status text := coalesce(p->>'status', 'confirmed');
  v_res uuid; v_folio uuid; v_conf text;
  g jsonb := p->'guest';
begin
  if v_guest is null and coalesce(trim(g->>'full_name'), '') = '' then raise exception 'Vui lòng nhập họ tên khách'; end if;
  if v_arr < v_today then raise exception 'Ngày đến không được trước hôm nay'; end if;
  if v_dep - v_arr < 1 then raise exception 'Ngày đi phải sau ngày đến ít nhất 1 đêm'; end if;
  if v_status not in ('confirmed', 'tentative') then raise exception 'Trạng thái đặt phòng không hợp lệ'; end if;
  select * into v_rt from public.room_types where id = (p->>'room_type_id')::uuid and branch_id = v_branch;
  if v_rt.id is null then raise exception 'Loại phòng không hợp lệ'; end if;
  if v_adults < 1 then raise exception 'Phải có ít nhất 1 người lớn'; end if;
  if v_adults + v_children > v_rt.max_pax + 1 then raise exception 'Loại % tối đa % khách (+1 giường phụ)', v_rt.code, v_rt.max_pax; end if;
  if v_rate is null or v_rate <= 0 then raise exception 'Giá phòng phải lớn hơn 0'; end if;
  if v_room is not null then perform private.check_room(v_room, v_arr, v_dep, null); end if;

  if v_guest is null then
    insert into public.guests (branch_id, guest_type, full_name, nationality, id_type, id_number, id_issued_date, id_issued_place,
      id_expiry_date, dob, gender, phone, email, address, company, visa_type, visa_number, visa_expiry, entry_date, port_of_entry)
    values (v_branch, coalesce(g->>'guest_type', 'vietnamese'), upper(trim(g->>'full_name')), coalesce(nullif(g->>'nationality', ''), 'VN'),
      coalesce(g->>'id_type', 'cccd'), coalesce(g->>'id_number', ''), nullif(g->>'id_issued_date', '')::date, coalesce(g->>'id_issued_place', ''),
      nullif(g->>'id_expiry_date', '')::date, nullif(g->>'dob', '')::date, nullif(g->>'gender', ''), coalesce(g->>'phone', ''),
      coalesce(g->>'email', ''), coalesce(g->>'address', ''), coalesce(g->>'company', ''), coalesce(g->>'visa_type', ''),
      coalesce(g->>'visa_number', ''), nullif(g->>'visa_expiry', '')::date, nullif(g->>'entry_date', '')::date, coalesce(g->>'port_of_entry', ''))
    returning id into v_guest;
  elsif not exists (select 1 from public.guests where id = v_guest and branch_id = v_branch) then
    raise exception 'Không tìm thấy khách';
  end if;

  v_conf := nextval('public.confirmation_no_seq')::text;
  insert into public.reservations (branch_id, confirmation_no, guest_id, room_type_id, room_id, arrival_date, departure_date,
    adults, children, rate, meal_plan, source, status, note, created_by)
  values (v_branch, v_conf, v_guest, v_rt.id, v_room, v_arr, v_dep, v_adults, v_children, v_rate,
    coalesce(p->>'meal_plan', 'RO'), coalesce(p->>'source', 'Direct'), v_status, trim(coalesce(p->>'note', '')), (select auth.uid()))
  returning id into v_res;
  insert into public.folios (branch_id, reservation_id, folio_no) values (v_branch, v_res, nextval('public.folio_no_seq')::text)
  returning id into v_folio;
  if coalesce((p->>'deposit_amount')::numeric, 0) > 0 then
    insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, payment_method, ref, posted_by)
    values (v_folio, v_today, 'DEPOSIT', 'credit', 'Đặt cọc giữ phòng', round((p->>'deposit_amount')::numeric),
      coalesce(p->>'deposit_method', 'cash_vnd'), '#' || v_conf, (select auth.uid()));
  end if;
  perform private.log('reservation.create', 'reservation', v_res, format('Đặt phòng #%s — %s%s', v_conf, private.guest_name(v_guest),
    coalesce(' · phòng ' || (select number from public.rooms where id = v_room), ' · chưa gán phòng')));
  return v_res;
end $$;

create or replace function public.assign_room(p_reservation_id uuid, p_room_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations := private.lock_reservation(p_reservation_id); v public.rooms;
begin
  if r.status not in ('confirmed', 'tentative') then raise exception 'Chỉ gán phòng cho đặt phòng chưa nhận phòng'; end if;
  if p_room_id is not null then v := private.check_room(p_room_id, r.arrival_date, r.departure_date, r.id); end if;
  update public.reservations set room_id = p_room_id where id = r.id;
  perform private.log('reservation.assign_room', 'reservation', r.id,
    case when p_room_id is null then format('Bỏ gán phòng #%s', r.confirmation_no)
         else format('Gán phòng %s cho #%s — %s', v.number, r.confirmation_no, private.guest_name(r.guest_id)) end);
end $$;

-- Kéo-thả trên Room Plan: đổi phòng và/hoặc dời ngày, giữ nguyên số đêm
create or replace function public.move_reservation(p_reservation_id uuid, p_room_id uuid, p_arrival date)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations := private.lock_reservation(p_reservation_id); v public.rooms; v_dep date;
begin
  if r.status not in ('confirmed', 'tentative') then raise exception 'Khách đã nhận phòng — không kéo thả được'; end if;
  if p_arrival < private.today() then raise exception 'Không thể dời về quá khứ'; end if;
  v_dep := p_arrival + (r.departure_date - r.arrival_date);
  v := private.check_room(p_room_id, p_arrival, v_dep, r.id);
  update public.reservations set room_id = p_room_id, arrival_date = p_arrival, departure_date = v_dep where id = r.id;
  perform private.log('reservation.move', 'reservation', r.id, format('Dời #%s sang phòng %s, %s', r.confirmation_no, v.number, to_char(p_arrival, 'DD/MM')));
end $$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations := private.lock_reservation(p_reservation_id);
begin
  if r.status not in ('confirmed', 'tentative') then raise exception 'Chỉ hủy được đặt phòng chưa nhận phòng'; end if;
  if exists (select 1 from public.folio_balances b join public.folios f on f.id = b.folio_id where f.reservation_id = r.id and b.total_credit > 0) then
    raise exception 'Folio còn tiền cọc — hoàn cọc (void giao dịch) trước khi hủy';
  end if;
  update public.reservations set status = 'cancelled' where id = r.id;
  update public.folios set status = 'closed', closed_at = now() where reservation_id = r.id;
  perform private.log('reservation.cancel', 'reservation', r.id, format('Hủy đặt phòng #%s — %s', r.confirmation_no, private.guest_name(r.guest_id)));
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4.4  Lưu trú & folio
-- ════════════════════════════════════════════════════════════════════

-- Check-in: phòng phải sạch, tự post tiền phòng + VAT 8% cho từng đêm còn lại
create or replace function public.check_in(p_reservation_id uuid, p_deposit_amount bigint default 0, p_deposit_method text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations := private.lock_reservation(p_reservation_id);
  v_today date := private.today();
  v_room public.rooms; v_code text; v_folio uuid; v_night date; v_from date;
begin
  if r.status not in ('tentative', 'confirmed') then raise exception 'Đặt phòng này không ở trạng thái chờ nhận phòng'; end if;
  if r.arrival_date > v_today then raise exception 'Chưa tới ngày đến (%)', to_char(r.arrival_date, 'DD/MM'); end if;
  if r.departure_date <= v_today then raise exception 'Đặt phòng đã quá ngày đi — đánh dấu no-show hoặc sửa ngày'; end if;
  if r.room_id is null then raise exception 'Chưa gán phòng'; end if;
  select * into v_room from public.rooms where id = r.room_id for update;
  if v_room.hk_status = 'out_of_order' then raise exception 'Phòng % đang hỏng', v_room.number; end if;
  if v_room.hk_status = 'dirty' then raise exception 'Phòng % chưa dọn — đánh dấu đã dọn trước khi nhận phòng', v_room.number; end if;
  if exists (select 1 from public.reservations where room_id = v_room.id and status = 'checked_in') then
    raise exception 'Phòng % đang có khách', v_room.number;
  end if;
  select code into v_code from public.room_types where id = v_room.room_type_id;
  select id into v_folio from public.folios where reservation_id = r.id;
  v_from := greatest(r.arrival_date, v_today);
  for v_night in select d::date from generate_series(v_from, r.departure_date - 1, interval '1 day') d loop
    insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, ref, posted_by) values
      (v_folio, v_night, 'ROOM', 'debit', format('Tiền phòng %s đêm %s', v_code, to_char(v_night, 'DD/MM')), r.rate, v_room.number, (select auth.uid())),
      (v_folio, v_night, 'TAX', 'debit', 'VAT 8%', round(r.rate * 0.08), 'AUTO', (select auth.uid()));
  end loop;
  if coalesce(p_deposit_amount, 0) > 0 then
    insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, payment_method, ref, posted_by)
    values (v_folio, v_today, 'DEPOSIT', 'credit', 'Đặt cọc khi nhận phòng', p_deposit_amount, coalesce(p_deposit_method, 'cash_vnd'), 'CI', (select auth.uid()));
  end if;
  update public.reservations set status = 'checked_in', checked_in_at = now(), arrival_date = v_from where id = r.id;
  perform private.log('reservation.check_in', 'reservation', r.id, format('%s — check-in phòng %s', private.guest_name(r.guest_id), v_room.number));
end $$;

create or replace function public.post_transaction(p_folio_id uuid, p_code text, p_description text, p_amount bigint, p_payment_method text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f public.folios; v_kind text; v_id uuid; v_method text;
begin
  select * into f from public.folios where id = p_folio_id and branch_id = private.require_branch();
  if f.id is null then raise exception 'Không tìm thấy folio'; end if;
  if f.status = 'closed' then raise exception 'Folio đã đóng'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0'; end if;
  v_kind := case when p_code in ('DEPOSIT', 'PAYMENT', 'DISCOUNT') then 'credit' else 'debit' end;
  v_method := case when v_kind = 'credit' and p_code <> 'DISCOUNT' then p_payment_method end;
  if v_kind = 'credit' and p_code <> 'DISCOUNT' and v_method is null then raise exception 'Chọn hình thức thanh toán'; end if;
  insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, payment_method, ref, posted_by)
  values (f.id, private.today(), p_code, v_kind, coalesce(nullif(trim(p_description), ''), p_code), p_amount, v_method, 'MANUAL', (select auth.uid()))
  returning id into v_id;
  perform private.log('folio.post', 'folio', f.id, format('%s %s₫ (%s) — folio #%s',
    case when v_kind = 'debit' then 'Post' else 'Thu' end, private.vnd(p_amount), coalesce(nullif(trim(p_description), ''), p_code), f.folio_no));
  return v_id;
end $$;

create or replace function public.void_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.folio_transactions; f public.folios;
begin
  select * into t from public.folio_transactions where id = p_transaction_id for update;
  select * into f from public.folios where id = t.folio_id and branch_id = private.require_branch();
  if t.id is null or f.id is null then raise exception 'Không tìm thấy giao dịch'; end if;
  if f.status = 'closed' then raise exception 'Folio đã đóng — không void được'; end if;
  if t.voided then raise exception 'Giao dịch đã void'; end if;
  update public.folio_transactions set voided = true, voided_at = now() where id = t.id;
  perform private.log('folio.void', 'folio', f.id, format('Void %s %s₫ — folio #%s', t.description, private.vnd(t.amount), f.folio_no));
end $$;

-- Check-out: trả sớm thì void tiền phòng các đêm chưa ở (luôn giữ đêm đầu), áp giảm giá, thu tiền, yêu cầu số dư = 0, đóng folio, phòng chuyển "dirty".
-- Trả về { "change": tiền thừa trả khách }
create or replace function public.check_out(p_reservation_id uuid, p_discount_percent numeric default 0,
  p_payment_method text default null, p_payment_amount bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations := private.lock_reservation(p_reservation_id);
  v_today date := private.today();
  v_folio public.folios; v_room public.rooms; v_early boolean; v_pct numeric; v_disc bigint; v_due bigint; v_change bigint := 0;
begin
  if r.status <> 'checked_in' then raise exception 'Khách không ở trạng thái đang ở'; end if;
  select * into v_folio from public.folios where reservation_id = r.id for update;
  v_early := r.departure_date > v_today;
  if v_early then
    update public.folio_transactions set voided = true, voided_at = now()
    where folio_id = v_folio.id and not voided and code in ('ROOM', 'TAX') and business_date >= greatest(v_today, r.arrival_date + 1);
  end if;
  v_pct := least(100, greatest(0, coalesce(p_discount_percent, 0)));
  if v_pct > 0 then
    select round(coalesce(sum(amount), 0) * v_pct / 100) into v_disc from public.folio_transactions
    where folio_id = v_folio.id and not voided and code in ('ROOM', 'TAX');
    if v_disc > 0 then
      insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, ref, posted_by)
      values (v_folio.id, v_today, 'DISCOUNT', 'credit', format('Giảm giá %s%% tiền phòng', v_pct), v_disc, 'CO', (select auth.uid()));
    end if;
  end if;
  select balance into v_due from public.folio_balances where folio_id = v_folio.id;
  if v_due > 0 then
    if p_payment_method is null or coalesce(p_payment_amount, 0) <= 0 then
      raise exception 'Folio còn nợ %₫ — nhập số tiền thu', private.vnd(v_due);
    end if;
    if p_payment_method <> 'city_ledger' and p_payment_amount < v_due then
      raise exception 'Thu thiếu %₫', private.vnd(v_due - p_payment_amount);
    end if;
    v_change := case when p_payment_method = 'city_ledger' then 0 else p_payment_amount - v_due end;
    insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, payment_method, ref, posted_by)
    values (v_folio.id, v_today, 'PAYMENT', 'credit',
      case when p_payment_method = 'city_ledger' then 'Chuyển công nợ (AR)' else 'Thanh toán khi trả phòng' end,
      v_due, p_payment_method, 'CO', (select auth.uid()));
  elsif v_due < 0 then
    raise exception 'Folio đang dư %₫ — void khoản cọc thừa trước khi trả phòng', private.vnd(-v_due);
  end if;
  update public.reservations set status = 'checked_out', checked_out_at = now(),
    departure_date = case when v_early then greatest(v_today, r.arrival_date + 1) else departure_date end where id = r.id;
  update public.folios set status = 'closed', closed_at = now() where id = v_folio.id;
  select * into v_room from public.rooms where id = r.room_id for update;
  insert into public.housekeeping_logs (room_id, from_status, to_status, changed_by) values (v_room.id, v_room.hk_status, 'dirty', (select auth.uid()));
  update public.rooms set hk_status = 'dirty', updated_at = now() where id = v_room.id;
  perform private.log('reservation.check_out', 'reservation', r.id,
    format('%s — check-out phòng %s%s', private.guest_name(r.guest_id), v_room.number, case when v_early then ' (trả sớm)' else '' end));
  return jsonb_build_object('change', v_change);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4.5  Buồng phòng & giao ca
-- ════════════════════════════════════════════════════════════════════

create or replace function public.set_housekeeping(p_room_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.rooms;
begin
  select * into v from public.rooms where id = p_room_id and branch_id = private.require_branch() for update;
  if v.id is null then raise exception 'Phòng không tồn tại'; end if;
  if p_status not in ('clean', 'dirty', 'out_of_order') then raise exception 'Trạng thái phòng không hợp lệ'; end if;
  if v.hk_status = p_status then return; end if;
  if p_status = 'out_of_order' and exists (select 1 from public.reservations where room_id = v.id and status = 'checked_in') then
    raise exception 'Phòng đang có khách — không thể báo hỏng';
  end if;
  insert into public.housekeeping_logs (room_id, from_status, to_status, changed_by) values (v.id, v.hk_status, p_status, (select auth.uid()));
  update public.rooms set hk_status = p_status, updated_at = now() where id = v.id;
  perform private.log('room.hk_status', 'room', v.id, format('Phòng %s — %s', v.number,
    case p_status when 'clean' then 'đã dọn xong' when 'dirty' then 'chờ dọn' else 'báo hỏng (OOO)' end));
end $$;

-- p: { business_date, shift, handover_to_name, cash_balance, general_note, incident_note, tasks: [{content, priority, done}] }
create or replace function public.submit_shift_report(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_to text := upper(trim(coalesce(p->>'handover_to_name', '')));
begin
  if v_to = '' then raise exception 'Nhập tên người nhận ca'; end if;
  insert into public.shift_reports (branch_id, business_date, shift, reporter_id, handover_to_name, cash_balance, general_note, incident_note)
  values (private.require_branch(), coalesce((p->>'business_date')::date, private.today()), p->>'shift', (select auth.uid()), v_to,
    coalesce(round((p->>'cash_balance')::numeric), 0), trim(coalesce(p->>'general_note', '')), trim(coalesce(p->>'incident_note', '')))
  returning id into v_id;
  insert into public.shift_tasks (shift_report_id, content, priority, done)
  select v_id, trim(t->>'content'), coalesce(t->>'priority', 'normal'), coalesce((t->>'done')::boolean, false)
  from jsonb_array_elements(coalesce(p->'tasks', '[]'::jsonb)) t
  where trim(coalesce(t->>'content', '')) <> '';
  perform private.log('shift.submit', 'shift_report', v_id, format('Gửi báo cáo giao ca cho %s', v_to));
  return v_id;
end $$;

create or replace function public.confirm_shift_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.shift_reports; v_name text;
begin
  select * into s from public.shift_reports where id = p_report_id and branch_id = private.require_branch() for update;
  if s.id is null then raise exception 'Không tìm thấy báo cáo'; end if;
  if s.status = 'confirmed' then raise exception 'Báo cáo đã được xác nhận'; end if;
  update public.shift_reports set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now() where id = s.id;
  select full_name into v_name from public.staff_profiles where id = s.reporter_id;
  perform private.log('shift.confirm', 'shift_report', s.id, format('Xác nhận nhận ca từ %s', v_name));
end $$;

create or replace function public.toggle_shift_task(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.shift_tasks t set done = not t.done
  from public.shift_reports s
  where t.id = p_task_id and s.id = t.shift_report_id and s.branch_id = private.require_branch();
  if not found then raise exception 'Không tìm thấy việc bàn giao'; end if;
end $$;

-- ─── Quyền gọi API ──────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'create_reservation(jsonb)', 'assign_room(uuid, uuid)', 'move_reservation(uuid, uuid, date)', 'cancel_reservation(uuid)',
    'check_in(uuid, bigint, text)', 'post_transaction(uuid, text, text, bigint, text)', 'void_transaction(uuid)',
    'check_out(uuid, numeric, text, bigint)', 'set_housekeeping(uuid, text)', 'submit_shift_report(jsonb)',
    'confirm_shift_report(uuid)', 'toggle_shift_task(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Realtime: phát thay đổi để 2 quầy lễ tân cùng thấy dữ liệu mới
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.reservations, public.folio_transactions, public.shift_reports, public.activity_logs;
  end if;
end $$;
