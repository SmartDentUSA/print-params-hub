create or replace function public.fn_normalize_phone(_raw text)
returns text language sql immutable set search_path = public as $$
  select case
    when d is null or d = '' then null
    when length(d) in (10,11) then '55'||d
    else d end
  from (select ltrim(regexp_replace(coalesce(_raw,''),'\D','','g'),'0') d) s
$$;

create or replace function public.fn_kol_phone_key(_raw text)
returns text language sql immutable set search_path = public as $$
  select case when length(public.fn_normalize_phone(_raw)) >= 10 then right(public.fn_normalize_phone(_raw),10) end
$$;

create or replace function public.fn_kol_lead_phone(_ddi text, _number text, _wa text, _tel text)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    public.fn_kol_phone_key(nullif(coalesce(_ddi,'')||coalesce(_number,''),'')),
    public.fn_kol_phone_key(_wa), public.fn_kol_phone_key(_tel))
$$;

create or replace function public.fn_is_internal_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id is not null and exists (
    select 1 from public.user_roles where user_id = _user_id
      and role in ('admin','user','author','support_agent'))
$$;

create or replace function public.fn_kol_log(
  _lead_id uuid, _event_type text, _entity_type text, _entity_id text, _entity_name text,
  _data jsonb, _value numeric default null, _channel text default 'kol')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key text; v_actor text; v_data jsonb; v_hash text; v_id uuid; v_ts timestamptz;
begin
  if _lead_id is null or coalesce(_event_type,'') = '' then
    raise exception 'fn_kol_log: lead_id e event_type obrigatórios';
  end if;
  v_key := coalesce(_data->>'dedupe_key', _event_type||':'||coalesce(_entity_id,'')||':'||_lead_id::text);
  v_actor := coalesce(case when auth.uid() is not null then 'equipe:'||auth.uid()::text end,
                      nullif(_data->>'actor',''), 'sistema');
  v_ts := coalesce(nullif(_data->>'event_timestamp','')::timestamptz, now());
  v_data := coalesce(_data,'{}'::jsonb) || jsonb_build_object('dedupe_key', v_key, 'actor', v_actor);
  v_hash := md5(_event_type||coalesce(_entity_id,'')||v_key);

  insert into public.lead_activity_log(lead_id, event_type, entity_type, entity_id, entity_name,
    event_timestamp, event_data, value_numeric, source_channel, dedupe_hash)
  values (_lead_id, _event_type, _entity_type, _entity_id, _entity_name, v_ts, v_data, _value,
    coalesce(_channel,'kol'), v_hash)
  on conflict (lead_id, event_type, dedupe_hash) where dedupe_hash is not null
  do update set event_data = excluded.event_data, entity_name = excluded.entity_name,
    value_numeric = excluded.value_numeric, entity_type = excluded.entity_type
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fn_kol_log(uuid,text,text,text,text,jsonb,numeric,text) from public, anon, authenticated;
grant execute on function public.fn_kol_log(uuid,text,text,text,text,jsonb,numeric,text) to service_role;

-- Pendências de celular (profissionais de Cursos)
create or replace function public.fn_kol_phone_pending()
returns table(lead_id uuid, nome text, prof_cro text, prof_wa_ddi text, prof_wa_number text,
  wa_phone text, telefone_normalized text, phone_key text, problema text, duplicado_com text)
language sql stable security definer set search_path = public as $$
  with p as (
    select a.id, a.nome, a.prof_cro, a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized,
      public.fn_kol_lead_phone(a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized) k
    from public.lia_attendances a
    where a.merged_into is null
      and (nullif(trim(a.prof_cro),'') is not null or a.prof_photo_url is not null
           or exists (select 1 from public.professional_courses c where c.producer_lead_id = a.id))
  )
  select p.id, p.nome, p.prof_cro, p.prof_wa_ddi, p.prof_wa_number, p.wa_phone, p.telefone_normalized, p.k,
    case when p.k is null then 'sem_celular' else 'duplicado' end,
    (select string_agg(o.nome, ', ') from p o where o.k = p.k and o.id <> p.id)
  from p
  where public.fn_is_internal_staff(auth.uid())
    and (p.k is null or exists (select 1 from p o where o.k = p.k and o.id <> p.id))
  order by 9, 2
$$;
revoke all on function public.fn_kol_phone_pending() from public, anon;
grant execute on function public.fn_kol_phone_pending() to authenticated, service_role;

create or replace function public.fn_kol_fix_phone(_lead_id uuid, _ddi text, _number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old record; v_ddi text; v_num text; v_key text; v_conf text;
begin
  if not public.fn_is_internal_staff(auth.uid()) then raise exception 'forbidden'; end if;
  v_ddi := nullif(regexp_replace(coalesce(_ddi,'55'),'\D','','g'),'');
  v_num := regexp_replace(coalesce(_number,''),'\D','','g');
  if length(v_num) < 10 or length(v_num) > 11 then raise exception 'Celular inválido: informe DDD + número'; end if;
  v_key := public.fn_kol_phone_key(coalesce(v_ddi,'55')||v_num);
  select prof_wa_ddi, prof_wa_number into v_old from public.lia_attendances where id = _lead_id and merged_into is null;
  if not found then raise exception 'Profissional não encontrado'; end if;
  select nome into v_conf from public.lia_attendances a
   where a.merged_into is null and a.id <> _lead_id
     and (nullif(trim(a.prof_cro),'') is not null or a.prof_photo_url is not null)
     and public.fn_kol_lead_phone(a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized) = v_key
   limit 1;
  if v_conf is not null then raise exception 'Este celular já pertence a %', v_conf; end if;
  update public.lia_attendances set prof_wa_ddi = coalesce(v_ddi,'55'), prof_wa_number = v_num,
    prof_updated_at = now() where id = _lead_id;
  perform public.fn_kol_log(_lead_id, 'kol_data_autofilled', 'lia_attendances', _lead_id::text, 'Celular do profissional',
    jsonb_build_object('campo','celular','antes', jsonb_build_object('prof_wa_ddi', v_old.prof_wa_ddi, 'prof_wa_number', v_old.prof_wa_number),
      'depois', jsonb_build_object('prof_wa_ddi', coalesce(v_ddi,'55'), 'prof_wa_number', v_num),
      'descricao', 'Celular corrigido pela equipe',
      'dedupe_key', 'kol_phone_fix:'||_lead_id||':'||extract(epoch from now())::bigint));
  return jsonb_build_object('ok', true, 'phone_key', v_key);
end $$;
revoke all on function public.fn_kol_fix_phone(uuid,text,text) from public, anon;
grant execute on function public.fn_kol_fix_phone(uuid,text,text) to authenticated, service_role;

-- professional_courses: escrita só para equipe interna
drop policy if exists "Authenticated can manage professional courses" on public.professional_courses;
create policy "Internal staff manage professional courses" on public.professional_courses
  for all to authenticated
  using (public.fn_is_internal_staff(auth.uid()))
  with check (public.fn_is_internal_staff(auth.uid()));

-- Avaliações: 1 por celular por curso + rate limit
alter table public.professional_course_ratings add column if not exists phone_key text;
create unique index if not exists uq_course_rating_phone on public.professional_course_ratings(course_id, phone_key) where phone_key is not null;
drop policy if exists "Anyone can submit a course rating" on public.professional_course_ratings;

create or replace function public.fn_submit_course_rating(_course_id uuid, _rating int, _comment text,
  _author_name text, _phone text, _visitor_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  v_key := public.fn_kol_phone_key(_phone);
  if v_key is null then raise exception 'Informe um celular válido para avaliar'; end if;
  if _rating is null or _rating < 1 or _rating > 5 then raise exception 'Nota inválida'; end if;
  if not exists (select 1 from public.professional_courses where id = _course_id and public_visible and status = 'publicado') then
    raise exception 'Curso não encontrado';
  end if;
  if exists (select 1 from public.professional_course_ratings where course_id = _course_id and phone_key = v_key) then
    raise exception 'Este celular já avaliou este curso';
  end if;
  if (select count(*) from public.professional_course_ratings
      where created_at > now() - interval '1 hour'
        and (visitor_key = _visitor_key or course_id = _course_id)) >= 10 then
    raise exception 'Muitas avaliações em pouco tempo. Tente mais tarde.';
  end if;
  insert into public.professional_course_ratings(course_id, rating, comment, author_name, visitor_key, phone_key)
  values (_course_id, _rating, left(nullif(trim(_comment),''),2000), left(nullif(trim(_author_name),''),120), left(_visitor_key,80), v_key);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.fn_submit_course_rating(uuid,int,text,text,text,text) from public;
grant execute on function public.fn_submit_course_rating(uuid,int,text,text,text,text) to anon, authenticated, service_role;