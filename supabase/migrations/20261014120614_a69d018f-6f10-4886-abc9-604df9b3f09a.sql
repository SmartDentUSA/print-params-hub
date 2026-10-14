alter table public.professional_courses
  add column if not exists review_note text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

create or replace function public.fn_kol_course_review(_course_id uuid, _action text, _note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; v_event text; v_status text; v_pub boolean; v_desc text;
begin
  perform public.fn_kol_staff_guard();
  select id, producer_lead_id, title, status from public.professional_courses where id = _course_id into c;
  if c.id is null then raise exception 'curso não encontrado'; end if;
  if _action = 'publish' then
    v_event := 'kol_course_published'; v_status := 'publicado'; v_pub := true; v_desc := 'Curso publicado: '||c.title;
  elsif _action = 'request_changes' then
    if coalesce(btrim(_note),'') = '' then raise exception 'informe os ajustes pedidos'; end if;
    v_event := 'kol_course_changes_requested'; v_status := 'rascunho'; v_pub := false; v_desc := 'Ajustes pedidos no curso: '||c.title;
  elsif _action = 'unpublish' then
    if c.status <> 'publicado' then raise exception 'curso não está publicado'; end if;
    v_event := 'kol_course_unpublished'; v_status := 'rascunho'; v_pub := false; v_desc := 'Curso despublicado: '||c.title;
  else raise exception 'ação inválida'; end if;

  update public.professional_courses
     set status = v_status, public_visible = v_pub, review_note = nullif(btrim(_note),''),
         reviewed_at = now(), reviewed_by = auth.uid(),
         published_at = case when v_pub then coalesce(published_at, now()) else published_at end
   where id = _course_id;

  perform public.fn_kol_log(c.producer_lead_id, v_event, 'professional_course', c.id::text, c.title,
    jsonb_build_object('descricao', v_desc, 'status_anterior', c.status, 'status_novo', v_status,
      'observacao', nullif(btrim(_note),''), 'dedupe_key', v_event||':'||c.id||':'||extract(epoch from clock_timestamp())::text));
  return jsonb_build_object('ok', true, 'status', v_status, 'public_visible', v_pub);
end $$;

revoke execute on function public.fn_kol_course_review(uuid, text, text) from public, anon;
grant execute on function public.fn_kol_course_review(uuid, text, text) to authenticated, service_role;