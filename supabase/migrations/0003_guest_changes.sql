-- Lịch sử thay đổi hồ sơ khách: mỗi lần sửa một trường của bảng guests
-- (từ màn hình Hồ sơ khách, Check-in hay Đặt phòng) ghi lại giá trị cũ → mới, ai sửa và lúc nào.
-- Ghi bằng trigger nên không cách sửa nào bỏ sót được.

create table if not exists public.guest_changes (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches (id),
  guest_id    uuid not null references public.guests (id) on delete cascade,
  field       text not null,
  old_value   text,
  new_value   text,
  changed_by  uuid references public.staff_profiles (id),
  changed_at  timestamptz not null default now()
);
create index if not exists guest_changes_guest_idx on public.guest_changes (guest_id, changed_at desc);
create index if not exists guest_changes_branch_idx on public.guest_changes (branch_id, changed_at desc);

alter table public.guest_changes enable row level security;
drop policy if exists guest_changes_read on public.guest_changes;
create policy guest_changes_read on public.guest_changes for select to authenticated
  using (branch_id = (select private.current_branch_id()));

create or replace function private.track_guest_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
  at timestamptz := now();
begin
  for k in select jsonb_object_keys(n) loop
    continue when k in ('id', 'branch_id', 'created_at');
    if (o -> k) is distinct from (n -> k) then
      insert into public.guest_changes (branch_id, guest_id, field, old_value, new_value, changed_by, changed_at)
      values (new.branch_id, new.id, k, o ->> k, n ->> k, (select auth.uid()), at);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists guests_track_changes on public.guests;
create trigger guests_track_changes after update on public.guests
  for each row execute function private.track_guest_changes();

grant select on public.guest_changes to authenticated;
grant all on public.guest_changes to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'guest_changes') then
    alter publication supabase_realtime add table public.guest_changes;
  end if;
end $$;
