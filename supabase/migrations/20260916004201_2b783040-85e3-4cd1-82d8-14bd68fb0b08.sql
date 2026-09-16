CREATE OR REPLACE FUNCTION public.fn_event_form_answer(p_form_data jsonb, p_labels text[])
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select nullif(trim(r->>'value'), '')
  from jsonb_each(coalesce(p_form_data, '{}'::jsonb)) f
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(f.value) = 'array' then f.value else '[]'::jsonb end) e
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(e->'responses') = 'array' then e->'responses' else '[]'::jsonb end) r
  where lower(trim(r->>'label')) = any(p_labels)
  order by coalesce(nullif(e->>'submitted_at', '')::timestamptz, '1970-01-01'::timestamptz) desc
  limit 1
$$;

DROP FUNCTION IF EXISTS public.fn_event_lead_stats(uuid);

CREATE FUNCTION public.fn_event_lead_stats(p_event_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  event_id uuid,
  total_leads bigint,
  by_seller jsonb,
  by_product jsonb,
  by_area jsonb,
  by_especialidade jsonb,
  tem_scanner_sim bigint,
  tem_impressora_sim bigint,
  imprime_placas_sim bigint,
  imprime_modelos_sim bigint,
  imprime_nanohibrida_sim bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with base as (
    select l.id, l.event_id, l.form_data,
           coalesce(nullif(trim(tm.nome_completo), ''), nullif(trim(l.proprietario_lead_crm), ''), 'Sem vendedor') as seller,
           coalesce(nullif(trim(l.produto_interesse), ''), nullif(trim(l.produto_interesse_auto), ''), 'Não informado') as produto,
           l.area_atuacao, l.especialidade, l.tem_scanner, l.tem_impressora,
           l.imprime_placas, l.imprime_modelos, l.imprime_resinas_ld
    from public.lia_attendances l
    left join public.team_members tm on tm.id = l.event_consultant_team_member_id
    where l.merged_into is null
      and l.event_id is not null
      and (p_event_id is null or l.event_id = p_event_id)
  ),
  enriched as (
    select b.event_id, b.seller, b.produto,
           coalesce(nullif(trim(b.area_atuacao), ''),
                    public.fn_event_form_answer(b.form_data, array['área de atuação','qual sua área de atuação','qual sua área de atuação?'])) as area,
           coalesce(nullif(trim(b.especialidade), ''),
                    public.fn_event_form_answer(b.form_data, array['especialidade','qual sua especialidade?','qual sua especialidade principal?'])) as espec,
           coalesce(nullif(trim(b.tem_scanner), ''),
                    public.fn_event_form_answer(b.form_data, array['tem scanner','qual scanner?','qual o modelo do seu scanner intraoral?'])) as v_scanner,
           coalesce(nullif(trim(b.tem_impressora), ''),
                    public.fn_event_form_answer(b.form_data, array['tem impresora?','tem impressora?','atualmente você utilza qual impressora no seu dia a dia?','qual impressora você teve contato o utiliza no seu dia a dia?','qual modelo da sua impressora 3d?'])) as v_impressora,
           coalesce(nullif(trim(b.imprime_placas), ''),
                    public.fn_event_form_answer(b.form_data, array['você imprimi placas miorrelaxantes?'])) as v_placas,
           coalesce(nullif(trim(b.imprime_modelos), ''),
                    public.fn_event_form_answer(b.form_data, array['você imprimi modelos?'])) as v_modelos,
           coalesce(nullif(trim(b.imprime_resinas_ld), ''),
                    public.fn_event_form_answer(b.form_data, array['você imprimi com resinas de elementos dentários de longa duração?'])) as v_nanohibrida
    from base b
  ),
  flags as (
    select e.*,
           (v_scanner is not null and lower(v_scanner) !~ '^(não|nao|nenhum)') as f_scanner,
           (v_impressora is not null and lower(v_impressora) !~ '^(não|nao|nenhum)') as f_impressora,
           (v_placas is not null and lower(v_placas) ~ '^sim') as f_placas,
           (v_modelos is not null and lower(v_modelos) ~ '^sim') as f_modelos,
           (v_nanohibrida is not null and lower(v_nanohibrida) ~ '^sim') as f_nanohibrida
    from enriched e
  ),
  sellers as (
    select event_id, seller, count(*) as qtd from flags group by 1, 2
  ),
  produtos as (
    select event_id, produto, count(*) as qtd from flags group by 1, 2
  ),
  areas as (
    select event_id, area, count(*) as qtd from flags where area is not null group by 1, 2
  ),
  especs as (
    select event_id, espec, count(*) as qtd from flags where espec is not null group by 1, 2
  )
  select f.event_id,
         count(*)::bigint as total_leads,
         (select coalesce(jsonb_agg(jsonb_build_object('seller', s.seller, 'qtd', s.qtd) order by s.qtd desc), '[]'::jsonb)
            from sellers s where s.event_id = f.event_id) as by_seller,
         (select coalesce(jsonb_agg(jsonb_build_object('produto', p.produto, 'qtd', p.qtd) order by p.qtd desc), '[]'::jsonb)
            from produtos p where p.event_id = f.event_id) as by_product,
         (select coalesce(jsonb_agg(jsonb_build_object('area', a.area, 'qtd', a.qtd) order by a.qtd desc), '[]'::jsonb)
            from areas a where a.event_id = f.event_id) as by_area,
         (select coalesce(jsonb_agg(jsonb_build_object('especialidade', sp.espec, 'qtd', sp.qtd) order by sp.qtd desc), '[]'::jsonb)
            from especs sp where sp.event_id = f.event_id) as by_especialidade,
         count(*) filter (where f.f_scanner)::bigint as tem_scanner_sim,
         count(*) filter (where f.f_impressora)::bigint as tem_impressora_sim,
         count(*) filter (where f.f_placas)::bigint as imprime_placas_sim,
         count(*) filter (where f.f_modelos)::bigint as imprime_modelos_sim,
         count(*) filter (where f.f_nanohibrida)::bigint as imprime_nanohibrida_sim
  from flags f
  group by f.event_id
$function$;