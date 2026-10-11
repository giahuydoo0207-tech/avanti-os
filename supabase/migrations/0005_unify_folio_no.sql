-- Gom số đặt phòng và số folio về MỘT số chung: folio_no = confirmation_no của đặt phòng.
-- Lễ tân chỉ cần nhớ một số (vd #1090040) để tìm cả đặt phòng lẫn folio.

-- 1) Folio mới: tự lấy số đặt phòng, bỏ qua số do create_reservation sinh ra
create or replace function private.folio_no_from_reservation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select confirmation_no into new.folio_no from public.reservations where id = new.reservation_id;
  return new;
end $$;

drop trigger if exists folios_folio_no on public.folios;
create trigger folios_folio_no before insert or update of reservation_id on public.folios
  for each row execute function private.folio_no_from_reservation();

-- 2) Folio cũ: đổi sang số đặt phòng
update public.folios f set folio_no = r.confirmation_no
from public.reservations r
where r.id = f.reservation_id and f.folio_no is distinct from r.confirmation_no;
