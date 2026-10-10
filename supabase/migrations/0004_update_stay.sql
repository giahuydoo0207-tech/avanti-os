-- Đổi loại phòng / số phòng ngay trong Hồ sơ khách.
--  · Đặt phòng chưa nhận (confirmed/tentative): đổi loại phòng, gán hoặc bỏ gán phòng.
--  · Khách đang ở (checked_in): đổi phòng (room move) — phòng mới phải sạch, phòng cũ chuyển sang "chờ dọn".
create or replace function public.update_stay(p_reservation_id uuid, p_room_type_id uuid, p_room_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations := private.lock_reservation(p_reservation_id);
  t public.room_types; v public.rooms; old_room text; old_type text;
begin
  if r.status not in ('confirmed', 'tentative', 'checked_in') then raise exception 'Đặt phòng đã kết thúc — không đổi phòng được'; end if;
  select * into t from public.room_types where id = p_room_type_id and branch_id = private.require_branch();
  if t.id is null then raise exception 'Loại phòng không tồn tại'; end if;
  if r.status = 'checked_in' and p_room_id is null then raise exception 'Khách đang ở phải có phòng'; end if;
  if p_room_id is not null then
    v := private.check_room(p_room_id, r.arrival_date, r.departure_date, r.id);
    if v.room_type_id <> t.id then raise exception 'Phòng % không thuộc loại %', v.number, t.code; end if;
    if r.status = 'checked_in' and p_room_id is distinct from r.room_id and v.hk_status = 'dirty' then
      raise exception 'Phòng % chưa dọn — chọn phòng sạch để chuyển khách', v.number;
    end if;
  end if;
  if p_room_id is not distinct from r.room_id and t.id = r.room_type_id then return; end if;

  select number into old_room from public.rooms where id = r.room_id;
  select code into old_type from public.room_types where id = r.room_type_id;
  if r.status = 'checked_in' and r.room_id is not null and p_room_id is distinct from r.room_id then
    update public.rooms set hk_status = 'dirty' where id = r.room_id;
  end if;
  update public.reservations set room_type_id = t.id, room_id = p_room_id where id = r.id;
  perform private.log('reservation.update_stay', 'reservation', r.id,
    format('Đổi phòng #%s: %s · %s → %s · %s', r.confirmation_no,
      coalesce(old_room, 'chưa gán'), old_type, coalesce(v.number, 'chưa gán'), t.code));
end $$;

revoke execute on function public.update_stay(uuid, uuid, uuid) from public, anon;
grant execute on function public.update_stay(uuid, uuid, uuid) to authenticated;
