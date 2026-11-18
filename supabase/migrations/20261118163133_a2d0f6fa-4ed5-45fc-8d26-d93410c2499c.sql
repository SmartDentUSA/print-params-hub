-- Visualizações das landing pages ligadas a cada evento (formulário do evento ou da tabela promocional do evento).
create or replace function public.fn_event_landing_views(p_event_id uuid default null)
returns table(event_id uuid, landing_pages integer, lp_views bigint, lp_unique_visitors bigint)
language sql stable security definer set search_path = public as $$
  with guard as (select public.has_panel_access(auth.uid()) ok),
  rel as (
    select f.event_id, f.id form_id from public.smartops_forms f where f.event_id is not null
    union
    select t.event_id, f.id from public.promotional_tables t join public.smartops_forms f on f.promotional_table_id = t.id
    where t.event_id is not null
  ),
  rel_f as (select r.* from rel r where (p_event_id is null or r.event_id = p_event_id) and (select ok from guard)),
  slugs as (
    select r.event_id, r.form_id, f.slug from rel_f r join public.smartops_forms f on f.id = r.form_id where f.slug is not null
    union
    select r.event_id, r.form_id, a.slug from rel_f r join public.smartops_form_slug_aliases a on a.form_id = r.form_id
  ),
  keys as (
    select event_id, '/lp/' || slug k from slugs
    union select event_id, '/f/lp/' || slug from slugs
  ),
  pv as (
    select regexp_replace(split_part(split_part(regexp_replace(v.page_path,
             '^https?://(parametros\.|www\.|admin\.)?smartdent\.com\.br(?=/|$)', '', 'i'), '?', 1), '#', 1), '/+$', '') k,
           v.session_id
    from public.lead_page_views v
    where v.page_path ilike '%/lp/%' and coalesce(v.page_type, '') <> 'click' and (select ok from guard)
  ),
  lp as (
    select r.event_id, count(distinct lp.id)::int n
    from rel_f r join public.smartops_form_landing_pages lp on lp.form_id = r.form_id and lp.status = 'published'
    group by r.event_id
  ),
  views as (
    select k.event_id, count(*)::bigint lp_views, count(distinct pv.session_id)::bigint lp_unique
    from pv join (select distinct event_id, k from keys) k on k.k = pv.k
    group by k.event_id
  )
  select e.event_id, coalesce(lp.n, 0), coalesce(v.lp_views, 0), coalesce(v.lp_unique, 0)
  from (select distinct event_id from rel_f) e
  left join lp on lp.event_id = e.event_id
  left join views v on v.event_id = e.event_id
$$;
revoke all on function public.fn_event_landing_views(uuid) from public, anon;
grant execute on function public.fn_event_landing_views(uuid) to authenticated, service_role;