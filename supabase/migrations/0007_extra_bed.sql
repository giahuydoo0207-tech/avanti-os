-- Giường phụ (Extra bed) cho đặt phòng: lưu số giường phụ, sửa được trong Hồ sơ khách và in trên Phiếu đăng ký.
alter table public.reservations add column if not exists extra_bed int not null default 0;
do $$ begin
  alter table public.reservations add constraint reservations_extra_bed_check check (extra_bed between 0 and 2);
exception when duplicate_object then null; end $$;

-- Đặt phòng cũ: khách vượt sức chứa loại phòng thì coi như đã có 1 giường phụ
update public.reservations r set extra_bed = 1
from public.room_types t
where t.id = r.room_type_id and r.extra_bed = 0 and r.adults + r.children > t.max_pax;

-- update_reservation (bản 0006) + nhận thêm extra_bed
create or replace function public.update_reservation(p_reservation_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations := private.lock_reservation(p_reservation_id);
  v_today date := private.today();
  v_arr date := coalesce(nullif(p->>'arrival_date', '')::date, r.arrival_date);
  v_dep date := coalesce(nullif(p->>'departure_date', '')::date, r.departure_date);
  v_adults int := coalesce((p->>'adults')::int, r.adults);
  v_children int := coalesce((p->>'children')::int, r.children);
  v_extra int := coalesce((p->>'extra_bed')::int, r.extra_bed);
  v_rate bigint := coalesce(round((p->>'rate')::numeric)::bigint, r.rate);
  v_meal text := coalesce(p->>'meal_plan', r.meal_plan);
  v_source text := coalesce(p->>'source', r.source);
  v_note text := coalesce(p->>'note', r.note);
  v_room_id uuid := case when p ? 'room_id' then nullif(p->>'room_id', '')::uuid else r.room_id end;
  v_rt public.room_types; v_room public.rooms; v_folio uuid; v_from date; v_night date;
  v_old_room text; v_old_type text; c text[] := '{}';
begin
  if r.status not in ('confirmed', 'tentative', 'checked_in') then raise exception 'Đặt phòng đã kết thúc — không sửa được'; end if;
  select * into v_rt from public.room_types
  where id = coalesce(nullif(p->>'room_type_id', '')::uuid, r.room_type_id) and branch_id = private.require_branch();
  if v_rt.id is null then raise exception 'Loại phòng không tồn tại'; end if;

  if r.status = 'checked_in' then
    if v_arr <> r.arrival_date then raise exception 'Khách đã nhận phòng — không đổi được ngày đến'; end if;
    if v_dep <> r.departure_date and v_dep <= v_today then raise exception 'Ngày đi phải sau hôm nay — trả phòng hôm nay thì dùng Check-out'; end if;
    if v_room_id is null then raise exception 'Khách đang ở phải có phòng'; end if;
  elsif v_arr <> r.arrival_date and v_arr < v_today then
    raise exception 'Ngày đến không được trước hôm nay';
  end if;
  if v_dep - v_arr < 1 then raise exception 'Ngày đi phải sau ngày đến ít nhất 1 đêm'; end if;
  if v_adults < 1 then raise exception 'Phải có ít nhất 1 người lớn'; end if;
  if v_children < 0 then raise exception 'Số trẻ em không hợp lệ'; end if;
  if v_adults + v_children > v_rt.max_pax + 1 then raise exception 'Loại % tối đa % khách (+1 giường phụ)', v_rt.code, v_rt.max_pax; end if;
  if v_rate is null or v_rate <= 0 then raise exception 'Giá phòng phải lớn hơn 0'; end if;
  if v_extra < 0 or v_extra > 2 then raise exception 'Giường phụ tối đa 2'; end if;

  if v_room_id is not null then
    if v_room_id is distinct from r.room_id or v_arr <> r.arrival_date or v_dep <> r.departure_date then
      v_room := private.check_room(v_room_id, v_arr, v_dep, r.id);
    else
      select * into v_room from public.rooms where id = v_room_id;
    end if;
    if v_room.room_type_id <> v_rt.id then raise exception 'Phòng % không thuộc loại %', v_room.number, v_rt.code; end if;
    if r.status = 'checked_in' and v_room_id is distinct from r.room_id and v_room.hk_status = 'dirty' then
      raise exception 'Phòng % chưa dọn — chọn phòng sạch để chuyển khách', v_room.number;
    end if;
  end if;

  -- Ghi lại thay đổi (cũ → mới)
  select number into v_old_room from public.rooms where id = r.room_id;
  select code into v_old_type from public.room_types where id = r.room_type_id;
  if v_rt.id <> r.room_type_id then c := c || format('Loại phòng %s → %s', v_old_type, v_rt.code); end if;
  if v_room_id is distinct from r.room_id then c := c || format('Phòng %s → %s', coalesce(v_old_room, 'chưa gán'), coalesce(v_room.number, 'chưa gán')); end if;
  if v_arr <> r.arrival_date then c := c || format('Ngày đến %s → %s', to_char(r.arrival_date, 'DD/MM'), to_char(v_arr, 'DD/MM')); end if;
  if v_dep <> r.departure_date then c := c || format('Ngày đi %s → %s', to_char(r.departure_date, 'DD/MM'), to_char(v_dep, 'DD/MM')); end if;
  if v_adults <> r.adults or v_children <> r.children then c := c || format('Khách %s+%s → %s+%s', r.adults, r.children, v_adults, v_children); end if;
  if v_extra <> r.extra_bed then c := c || format('Giường phụ %s → %s', r.extra_bed, v_extra); end if;
  if v_rate <> r.rate then c := c || format('Giá %s → %s', private.vnd(r.rate), private.vnd(v_rate)); end if;
  if v_meal <> r.meal_plan then c := c || format('Gói ăn %s → %s', r.meal_plan, v_meal); end if;
  if v_source <> r.source then c := c || format('Nguồn %s → %s', r.source, v_source); end if;
  if v_note is distinct from r.note then c := c || 'Ghi chú'::text; end if;
  if cardinality(c) = 0 then return; end if;

  if r.status = 'checked_in' then
    select id into v_folio from public.folios where reservation_id = r.id;
    v_from := null;
    if v_rate <> r.rate then
      v_from := greatest(v_today, r.arrival_date);
      update public.folio_transactions set voided = true, voided_at = now()
      where folio_id = v_folio and not voided and code in ('ROOM', 'TAX') and business_date >= v_from;
    elsif v_dep < r.departure_date then
      update public.folio_transactions set voided = true, voided_at = now()
      where folio_id = v_folio and not voided and code in ('ROOM', 'TAX') and business_date >= v_dep;
    elsif v_dep > r.departure_date then
      v_from := r.departure_date;
    end if;
    if v_from is not null then
      for v_night in select d::date from generate_series(v_from, v_dep - 1, interval '1 day') d loop
        insert into public.folio_transactions (folio_id, business_date, code, kind, description, amount, ref, posted_by) values
          (v_folio, v_night, 'ROOM', 'debit', format('Tiền phòng %s đêm %s', v_rt.code, to_char(v_night, 'DD/MM')), v_rate, v_room.number, (select auth.uid())),
          (v_folio, v_night, 'TAX', 'debit', 'VAT 8%', round(v_rate * 0.08), 'AUTO', (select auth.uid()));
      end loop;
    end if;
    if v_room_id is distinct from r.room_id and r.room_id is not null then
      update public.rooms set hk_status = 'dirty' where id = r.room_id;
    end if;
  end if;

  update public.reservations set room_type_id = v_rt.id, room_id = v_room_id, arrival_date = v_arr, departure_date = v_dep,
    adults = v_adults, children = v_children, extra_bed = v_extra, rate = v_rate, meal_plan = v_meal, source = v_source, note = v_note
  where id = r.id;
  perform private.log('reservation.update', 'reservation', r.id, format('Sửa đặt phòng #%s: %s', r.confirmation_no, array_to_string(c, '; ')));
end $$;

revoke execute on function public.update_reservation(uuid, jsonb) from public, anon;
grant execute on function public.update_reservation(uuid, jsonb) to authenticated;
