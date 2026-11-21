create or replace function public.fn_daily_sales_report(p_day date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language sql stable security definer set search_path = public as $$
  with b as (select (p_day::timestamp at time zone 'America/Sao_Paulo') d0,
                    ((p_day + 1)::timestamp at time zone 'America/Sao_Paulo') d1,
                    (date_trunc('month', p_day)::timestamp at time zone 'America/Sao_Paulo') m0)
  select jsonb_build_object(
    'day', p_day,
    'leads_total', (select count(*) from lia_attendances, b where merged_into is null and created_at >= d0 and created_at < d1),
    'leads_month_total', (select count(*) from lia_attendances, b where merged_into is null and created_at >= m0 and created_at < d1),
    'leads_month_ltv', (select count(*) from lia_attendances, b where merged_into is null and created_at >= m0 and created_at < d1 and coalesce(ltv_total,0) > 0),
    'leads_month_ltv_value', (select coalesce(sum(ltv_total),0) from lia_attendances, b where merged_into is null and created_at >= m0 and created_at < d1 and coalesce(ltv_total,0) > 0),
    'leads_by_origin', coalesce((select jsonb_agg(jsonb_build_object('origem', o, 'total', n) order by n desc) from (
        select coalesce(nullif(trim(coalesce(origem_primeiro_contato, form_name, source)), ''), 'Sem origem') o, count(*) n
        from lia_attendances, b where merged_into is null and created_at >= d0 and created_at < d1 group by 1) x), '[]'::jsonb),
    'won_day_count', (select count(*) from deals, b where status = 'ganha' and closed_at >= d0 and closed_at < d1),
    'won_day_value', (select coalesce(sum(value),0) from deals, b where status = 'ganha' and closed_at >= d0 and closed_at < d1),
    'won_month_count', (select count(*) from deals, b where status = 'ganha' and closed_at >= m0 and closed_at < d1),
    'won_month_value', (select coalesce(sum(value),0) from deals, b where status = 'ganha' and closed_at >= m0 and closed_at < d1)
  );
$$;
revoke all on function public.fn_daily_sales_report(date) from public, anon, authenticated;
grant execute on function public.fn_daily_sales_report(date) to service_role;