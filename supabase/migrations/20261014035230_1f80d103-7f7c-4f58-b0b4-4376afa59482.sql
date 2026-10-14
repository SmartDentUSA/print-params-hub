revoke execute on function public.fn_trg_lia_kol_flags() from anon, public;

create table public.kol_event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.smartops_events(id) on delete cascade,
  lead_id uuid not null,
  contract_id uuid not null references public.kol_contracts(id),
  status text not null default 'convidado',
  is_test boolean not null default false,
  message_mode text not null default 'simulado',
  invited_by uuid, responded_at timestamptz, response_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (event_id, lead_id)
);
create table public.kol_event_slots (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.kol_event_invites(id) on delete cascade,
  event_id uuid not null, lead_id uuid not null,
  slot_type text not null,
  slot_date date not null, start_time time not null, end_time time not null,
  status text not null default 'agendado',
  hours_done numeric(6,2), done_at timestamptz, cancelled_at timestamptz, cancel_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.kol_event_invites, public.kol_event_slots to authenticated;
grant all on public.kol_event_invites, public.kol_event_slots to service_role;
alter table public.kol_event_invites enable row level security;
alter table public.kol_event_slots enable row level security;
create policy "Equipe interna lê convites KOL" on public.kol_event_invites for select to authenticated using (public.fn_is_internal_staff(auth.uid()));
create policy "Equipe interna lê turnos KOL" on public.kol_event_slots for select to authenticated using (public.fn_is_internal_staff(auth.uid()));

create or replace function public.fn_kol_ev_validate() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_table_name='kol_event_invites' and new.status not in ('convidado','aceito','recusado','cancelado') then raise exception 'status de convite inválido'; end if;
  if tg_table_name='kol_event_slots' then
    if new.slot_type not in ('palestra','estande') then raise exception 'tipo de turno inválido'; end if;
    if new.status not in ('agendado','cancelado','realizado') then raise exception 'status de turno inválido'; end if;
    if new.end_time <= new.start_time then raise exception 'fim deve ser depois do início'; end if;
  end if;
  new.updated_at := now(); return new;
end $$;
create trigger trg_kol_inv_validate before insert or update on public.kol_event_invites for each row execute function public.fn_kol_ev_validate();
create trigger trg_kol_slot_validate before insert or update on public.kol_event_slots for each row execute function public.fn_kol_ev_validate();

-- ÚNICA função de cálculo de horas (timeline, JSON e visão usam esta)
create or replace function public.fn_kol_slot_hours(_start time, _end time) returns numeric
language sql immutable set search_path=public as $$
  select round(greatest(extract(epoch from (_end - _start)),0)/3600.0, 2)
$$;

create or replace function public.fn_kol_staff_guard() returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.fn_is_internal_staff(auth.uid()) then raise exception 'acesso restrito à equipe interna'; end if;
  if auth.uid() is null and coalesce(auth.role(),'') not in ('service_role','') then raise exception 'não autorizado'; end if;
end $$;

create or replace function public.fn_kol_invite(_event_id uuid, _lead_id uuid, _test boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare c record; e record; v_id uuid;
begin
  perform public.fn_kol_staff_guard();
  select * into e from smartops_events where id=_event_id; if e.id is null then raise exception 'evento não encontrado'; end if;
  select * into c from kol_contracts where lead_id=_lead_id and status='assinado' and revoked_at is null order by signed_at desc nulls last limit 1;
  if c.id is null then raise exception 'convite recusado: profissional sem contrato assinado e vigente'; end if;
  if c.is_test and not _test then raise exception 'convite recusado: contrato de teste só pode ser convidado em modo teste'; end if;
  if _test and not c.is_test then raise exception 'convite recusado: modo teste exige contrato de teste'; end if;
  insert into kol_event_invites(event_id, lead_id, contract_id, is_test, invited_by)
  values (_event_id, _lead_id, c.id, c.is_test, auth.uid()) returning id into v_id;
  perform fn_kol_log(_lead_id,'kol_event_invited','kol_event_invite',v_id::text,e.name,
    jsonb_build_object('descricao','Convidado para '||e.name,'evento',e.name,'event_id',_event_id,'contrato',c.number,
      'whatsapp','simulado (nenhuma mensagem enviada)','is_test',c.is_test));
  return v_id;
end $$;

create or replace function public.fn_kol_invite_respond(_invite_id uuid, _accept boolean, _note text default null, _actor text default 'equipe')
returns void language plpgsql security definer set search_path=public as $$
declare i record; e record;
begin
  perform public.fn_kol_staff_guard();
  select * into i from kol_event_invites where id=_invite_id for update;
  if i.id is null then raise exception 'convite não encontrado'; end if;
  if i.status <> 'convidado' then raise exception 'convite já respondido (%)', i.status; end if;
  select name into e from smartops_events where id=i.event_id;
  update kol_event_invites set status=case when _accept then 'aceito' else 'recusado' end, responded_at=now(), response_note=_note where id=_invite_id;
  perform fn_kol_log(i.lead_id, case when _accept then 'kol_event_invite_accepted' else 'kol_event_invite_declined' end,
    'kol_event_invite', _invite_id::text, e.name,
    jsonb_build_object('descricao',(case when _accept then 'Aceitou convite para ' else 'Recusou convite para ' end)||e.name,
      'evento',e.name,'observacao',_note,'actor',_actor,'is_test',i.is_test));
end $$;

create or replace function public.fn_kol_schedule_slot(_invite_id uuid, _type text, _date date, _start time, _end time)
returns uuid language plpgsql security definer set search_path=public as $$
declare i record; e record; v_id uuid; v_h numeric;
begin
  perform public.fn_kol_staff_guard();
  select * into i from kol_event_invites where id=_invite_id;
  if i.id is null then raise exception 'convite não encontrado'; end if;
  if i.status <> 'aceito' then raise exception 'agendamento recusado: convite não aceito (situação: %)', i.status; end if;
  select name into e from smartops_events where id=i.event_id;
  insert into kol_event_slots(invite_id,event_id,lead_id,slot_type,slot_date,start_time,end_time,is_test)
  values (_invite_id,i.event_id,i.lead_id,_type,_date,_start,_end,i.is_test) returning id into v_id;
  v_h := fn_kol_slot_hours(_start,_end);
  perform fn_kol_log(i.lead_id, case when _type='palestra' then 'kol_talk_scheduled' else 'kol_stand_scheduled' end,
    'kol_event_slot', v_id::text, e.name,
    jsonb_build_object('descricao',initcap(_type)||' agendada em '||e.name,'evento',e.name,'data',_date,'inicio',_start,'fim',_end,
      'horas_previstas',v_h,'is_test',i.is_test), v_h);
  return v_id;
end $$;

create or replace function public.fn_kol_cancel_slot(_slot_id uuid, _reason text)
returns void language plpgsql security definer set search_path=public as $$
declare s record; e record;
begin
  perform public.fn_kol_staff_guard();
  select * into s from kol_event_slots where id=_slot_id for update;
  if s.id is null then raise exception 'turno não encontrado'; end if;
  if s.status <> 'agendado' then raise exception 'só turno agendado pode ser cancelado (situação: %)', s.status; end if;
  select name into e from smartops_events where id=s.event_id;
  update kol_event_slots set status='cancelado', cancelled_at=now(), cancel_reason=_reason where id=_slot_id;
  perform fn_kol_log(s.lead_id,'kol_schedule_cancelled','kol_event_slot',_slot_id::text,e.name,
    jsonb_build_object('descricao',initcap(s.slot_type)||' cancelada em '||e.name,'evento',e.name,'data',s.slot_date,
      'inicio',s.start_time,'fim',s.end_time,'motivo',_reason,'is_test',s.is_test));
end $$;

create or replace function public.fn_kol_mark_done(_slot_id uuid, _start time default null, _end time default null)
returns numeric language plpgsql security definer set search_path=public as $$
declare s record; e record; v_h numeric; v_s time; v_e time;
begin
  perform public.fn_kol_staff_guard();
  select * into s from kol_event_slots where id=_slot_id for update;
  if s.id is null then raise exception 'turno não encontrado'; end if;
  if s.status <> 'agendado' then raise exception 'só turno agendado pode ser realizado (situação: %)', s.status; end if;
  v_s := coalesce(_start,s.start_time); v_e := coalesce(_end,s.end_time);
  v_h := fn_kol_slot_hours(v_s,v_e);
  update kol_event_slots set status='realizado', start_time=v_s, end_time=v_e, hours_done=v_h, done_at=now() where id=_slot_id;
  select name into e from smartops_events where id=s.event_id;
  perform fn_kol_log(s.lead_id,'kol_slot_done','kol_event_slot',_slot_id::text,e.name,
    jsonb_build_object('descricao',initcap(s.slot_type)||' realizada em '||e.name||' ('||v_h||' h)','evento',e.name,'tipo',s.slot_type,
      'data',s.slot_date,'inicio',v_s,'fim',v_e,'horas',v_h,'is_test',s.is_test), v_h);
  return v_h;
end $$;

create or replace view public.v_kol_event_hours with (security_invoker=true) as
select s.lead_id, s.is_test,
  count(*) filter (where s.status='realizado') turnos_realizados,
  coalesce(sum(s.hours_done) filter (where s.status='realizado' and s.slot_type='palestra'),0) horas_palestra,
  coalesce(sum(s.hours_done) filter (where s.status='realizado' and s.slot_type='estande'),0) horas_estande,
  coalesce(sum(s.hours_done) filter (where s.status='realizado'),0) horas_total,
  count(*) filter (where s.status='agendado') turnos_agendados,
  count(*) filter (where s.status='cancelado') turnos_cancelados
from public.kol_event_slots s group by s.lead_id, s.is_test;
grant select on public.v_kol_event_hours to authenticated, service_role;

revoke execute on function public.fn_kol_ev_validate(), public.fn_kol_slot_hours(time,time), public.fn_kol_staff_guard(),
  public.fn_kol_invite(uuid,uuid,boolean), public.fn_kol_invite_respond(uuid,boolean,text,text),
  public.fn_kol_schedule_slot(uuid,text,date,time,time), public.fn_kol_cancel_slot(uuid,text),
  public.fn_kol_mark_done(uuid,time,time) from anon, public;
grant execute on function public.fn_kol_slot_hours(time,time), public.fn_kol_invite(uuid,uuid,boolean), public.fn_kol_invite_respond(uuid,boolean,text,text),
  public.fn_kol_schedule_slot(uuid,text,date,time,time), public.fn_kol_cancel_slot(uuid,text), public.fn_kol_mark_done(uuid,time,time)
  to authenticated, service_role;