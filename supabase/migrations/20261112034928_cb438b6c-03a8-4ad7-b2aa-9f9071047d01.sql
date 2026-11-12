create table if not exists public.wa_group_instance_pin (
  group_jid     text primary key,
  instance_name text not null,
  motivo        text,
  created_at    timestamptz not null default now()
);

comment on table public.wa_group_instance_pin is
  'Grupos cuja instancia de envio e fixa. O trigger trg_pin_group_instance em wa_groups forca instance_name a este valor, ignorando o que o sync tentar gravar.';

revoke all on public.wa_group_instance_pin from anon, authenticated, public;
grant select on public.wa_group_instance_pin to authenticated;
grant all on public.wa_group_instance_pin to service_role;

alter table public.wa_group_instance_pin enable row level security;

drop policy if exists "admin_read_wa_group_instance_pin" on public.wa_group_instance_pin;
create policy "admin_read_wa_group_instance_pin"
  on public.wa_group_instance_pin
  for select
  to authenticated
  using (public.is_admin((select auth.uid())));

create or replace function public.fn_pin_group_instance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pinned text;
begin
  select instance_name into v_pinned
    from public.wa_group_instance_pin where group_jid = new.group_jid;
  if v_pinned is not null and new.instance_name is distinct from v_pinned then
    new.instance_name := v_pinned;
  end if;
  return new;
end; $$;

drop trigger if exists trg_pin_group_instance on public.wa_groups;
create trigger trg_pin_group_instance
  before insert or update on public.wa_groups
  for each row execute function public.fn_pin_group_instance();

revoke execute on function public.fn_pin_group_instance() from anon, public;