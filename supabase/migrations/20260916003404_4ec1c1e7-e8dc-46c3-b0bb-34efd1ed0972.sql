create or replace function public.fn_event_lead_stats(p_event_id uuid default null)
returns table (
  event_id uuid,
  total_leads bigint,
  by_seller jsonb,
  by_product jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select l.event_id,
           coalesce(nullif(trim(tm.nome_completo), ''), nullif(trim(l.proprietario_lead_crm), ''), 'Sem vendedor') as seller,
           coalesce(nullif(trim(l.produto_interesse), ''), nullif(trim(l.produto_interesse_auto), ''), 'Não informado') as produto
    from public.lia_attendances l
    left join public.team_members tm on tm.id = l.event_consultant_team_member_id
    where l.merged_into is null
      and l.event_id is not null
      and (p_event_id is null or l.event_id = p_event_id)
  ),
  sellers as (
    select event_id, seller, count(*) as qtd from base group by 1,2
  ),
  produtos as (
    select event_id, produto, count(*) as qtd from base group by 1,2
  )
  select b.event_id,
         count(*)::bigint as total_leads,
         (select coalesce(jsonb_agg(jsonb_build_object('seller', s.seller, 'qtd', s.qtd) order by s.qtd desc), '[]'::jsonb)
            from sellers s where s.event_id = b.event_id) as by_seller,
         (select coalesce(jsonb_agg(jsonb_build_object('produto', p.produto, 'qtd', p.qtd) order by p.qtd desc), '[]'::jsonb)
            from produtos p where p.event_id = b.event_id) as by_product
  from base b
  group by b.event_id
$$;

grant execute on function public.fn_event_lead_stats(uuid) to authenticated, service_role;