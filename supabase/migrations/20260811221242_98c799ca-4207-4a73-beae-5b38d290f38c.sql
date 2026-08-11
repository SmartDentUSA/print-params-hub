create or replace function public.fn_automation_run_stats()
returns table (
  automation_id uuid,
  enviados bigint,
  erros bigint,
  ultimo_envio timestamptz,
  ultimo_canal text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.automation_id,
         count(*) filter (where r.status = 'enviado')::bigint as enviados,
         count(*) filter (where r.status = 'erro')::bigint as erros,
         max(r.created_at) filter (where r.status = 'enviado') as ultimo_envio,
         (array_agg(r.canal order by r.created_at desc) filter (where r.status = 'enviado'))[1] as ultimo_canal
  from public.smartops_automation_runs r
  group by r.automation_id
$$;

grant execute on function public.fn_automation_run_stats() to authenticated, anon, service_role;