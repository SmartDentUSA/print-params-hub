alter table public.smartops_courses add column if not exists instructor_lead_id uuid;
alter table public.smartops_course_turmas add column if not exists instructor_lead_id uuid;
create index if not exists idx_smartops_courses_instructor_lead on public.smartops_courses(instructor_lead_id) where instructor_lead_id is not null;
create index if not exists idx_smartops_turmas_instructor_lead on public.smartops_course_turmas(instructor_lead_id) where instructor_lead_id is not null;

create or replace function public.fn_trg_kol_instructor_link()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_kind text; v_old uuid; v_new uuid;
begin
  v_new := new.instructor_lead_id;
  v_old := case when tg_op = 'UPDATE' then old.instructor_lead_id else null end;
  if v_new is not distinct from v_old then return new; end if;
  if tg_table_name = 'smartops_courses' then
    v_kind := 'smartops_course'; v_name := new.title;
  else
    v_kind := 'smartops_turma';
    select c.title || ' · ' || coalesce(new.label, 'turma') into v_name from public.smartops_courses c where c.id = new.course_id;
  end if;
  if v_old is not null then
    perform public.fn_kol_log(v_old, 'kol_instructor_unlinked', v_kind, new.id::text, v_name,
      jsonb_build_object('descricao', 'Desvinculado como instrutor: '||coalesce(v_name,''),
        'dedupe_key', 'kol_instructor_unlinked:'||new.id||':'||extract(epoch from now())::bigint));
  end if;
  if v_new is not null then
    perform public.fn_kol_log(v_new, 'kol_instructor_linked', v_kind, new.id::text, v_name,
      jsonb_build_object('descricao', 'Vinculado como instrutor: '||coalesce(v_name,''),
        'dedupe_key', 'kol_instructor_linked:'||new.id||':'||extract(epoch from now())::bigint));
  end if;
  return new;
end $$;
revoke all on function public.fn_trg_kol_instructor_link() from public, anon, authenticated;

drop trigger if exists trg_kol_instructor_link on public.smartops_courses;
create trigger trg_kol_instructor_link after insert or update of instructor_lead_id on public.smartops_courses
  for each row execute function public.fn_trg_kol_instructor_link();
drop trigger if exists trg_kol_instructor_link on public.smartops_course_turmas;
create trigger trg_kol_instructor_link after insert or update of instructor_lead_id on public.smartops_course_turmas
  for each row execute function public.fn_trg_kol_instructor_link();

-- Avaliações: visitante só lê colunas públicas e só de cursos publicados
revoke select on public.professional_course_ratings from anon, authenticated;
grant select (id, course_id, rating, comment, author_name, created_at) on public.professional_course_ratings to anon, authenticated;
grant all on public.professional_course_ratings to service_role;
drop policy if exists "Course ratings are publicly readable" on public.professional_course_ratings;
create policy "Ratings of published courses are public" on public.professional_course_ratings
  for select to anon, authenticated
  using (exists (select 1 from public.professional_courses pc where pc.id = course_id and pc.public_visible and pc.status = 'publicado')
         or public.fn_is_internal_staff(auth.uid()));

create or replace function public.fn_submit_course_rating(_course_id uuid, _rating int, _comment text,
  _author_name text, _phone text, _visitor_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_key text; c record; v_prod_key text; v_id uuid;
begin
  v_key := public.fn_kol_phone_key(_phone);
  if v_key is null then raise exception 'Informe um celular válido para avaliar'; end if;
  if _rating is null or _rating < 1 or _rating > 5 then raise exception 'Nota inválida'; end if;
  select pc.id, pc.title, pc.producer_lead_id into c from public.professional_courses pc
   where pc.id = _course_id and pc.public_visible and pc.status = 'publicado';
  if c.id is null then raise exception 'Curso não encontrado'; end if;
  select public.fn_kol_phone_key(coalesce(l.telefone_normalized, l.telefone_raw)) into v_prod_key
    from public.lia_attendances l where l.id = c.producer_lead_id;
  if v_prod_key is not null and v_prod_key = v_key then
    raise exception 'O autor do curso não pode avaliar o próprio curso';
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
  values (_course_id, _rating, left(nullif(trim(_comment),''),2000), left(nullif(trim(_author_name),''),120), left(_visitor_key,80), v_key)
  returning id into v_id;
  perform public.fn_kol_log(c.producer_lead_id, 'kol_course_rated', 'professional_course', c.id::text, c.title,
    jsonb_build_object('descricao', 'Curso avaliado com nota '||_rating||': '||c.title, 'nota', _rating,
      'rating_id', v_id, 'actor', 'visitante', 'dedupe_key', 'kol_course_rated:'||v_id), _rating);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.fn_submit_course_rating(uuid,int,text,text,text,text) from public;
grant execute on function public.fn_submit_course_rating(uuid,int,text,text,text,text) to anon, authenticated, service_role;