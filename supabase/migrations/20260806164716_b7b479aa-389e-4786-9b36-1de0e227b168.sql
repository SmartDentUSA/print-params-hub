create or replace function public.fn_social_internal_analytics(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with since as (
  select (now() - make_interval(days => greatest(coalesce(p_days, 30), 1)))::timestamptz as ts
),
inst as (
  select tm.nome_completo as nome,
         tm.evolution_instance_name as instance,
         tm.evolution_phone as phone,
         coalesce(tm.ativo, false) as ativo
  from team_members tm
  where tm.evolution_instance_name is not null
    and tm.evolution_instance_name <> ''
),
health as (
  select provider_instance, provider, status, consecutive_errors, last_success_at, last_error_at
  from wa_provider_session_health
),
ml as (
  select evolution_instance,
         count(*) as total,
         count(*) filter (where status ilike 'sent%' or status ilike 'success%' or status ilike 'ok%' or status ilike 'enviad%') as ok,
         count(*) filter (where status ilike 'error%' or status ilike 'fail%' or status ilike 'erro%') as fail
  from message_logs, since
  where message_logs.created_at >= since.ts
  group by 1
),
ml_daily as (
  select date_trunc('day', message_logs.created_at)::date as d, count(*) as c
  from message_logs, since
  where message_logs.created_at >= since.ts
  group by 1
),
grp as (
  select provider_instance, count(*) as total, count(*) filter (where success) as ok
  from wa_send_log, since
  where wa_send_log.created_at >= since.ts
  group by 1
),
lia_daily as (
  select date_trunc('day', agent_interactions.created_at)::date as d,
         count(*) as c,
         count(*) filter (where unanswered) as unanswered
  from agent_interactions, since
  where agent_interactions.created_at >= since.ts
  group by 1
),
lia_tot as (
  select count(*) as interactions,
         count(distinct session_id) as sessions,
         count(*) filter (where unanswered) as unanswered,
         round(avg(top_similarity)::numeric, 3) as avg_similarity,
         round(avg(judge_score)::numeric, 2) as avg_judge
  from agent_interactions, since
  where agent_interactions.created_at >= since.ts
),
lia_sess as (
  select count(*) as total_sessions,
         count(*) filter (where is_human) as human_takeover,
         count(*) filter (where handoff_at is not null) as handoffs
  from agent_sessions, since
  where agent_sessions.created_at >= since.ts
)
select jsonb_build_object(
  'days', greatest(coalesce(p_days, 30), 1),
  'instances', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', i.nome,
      'instance', i.instance,
      'phone', i.phone,
      'active', i.ativo,
      'provider', h.provider,
      'health_status', h.status,
      'consecutive_errors', h.consecutive_errors,
      'last_success_at', h.last_success_at,
      'last_error_at', h.last_error_at,
      'sent', coalesce(m.total, 0),
      'sent_ok', coalesce(m.ok, 0),
      'sent_fail', coalesce(m.fail, 0),
      'group_sent', coalesce(g.total, 0),
      'group_ok', coalesce(g.ok, 0)
    ) order by coalesce(m.total, 0) + coalesce(g.total, 0) desc)
    from inst i
    left join health h on h.provider_instance = i.instance
    left join ml m on m.evolution_instance = i.instance
    left join grp g on g.provider_instance = i.instance
  ), '[]'::jsonb),
  'wa_daily', coalesce((
    select jsonb_agg(jsonb_build_object('date', d, 'count', c) order by d) from ml_daily
  ), '[]'::jsonb),
  'lia', (select to_jsonb(t) from lia_tot t) || (select to_jsonb(s) from lia_sess s),
  'lia_daily', coalesce((
    select jsonb_agg(jsonb_build_object('date', d, 'count', c, 'unanswered', unanswered) order by d) from lia_daily
  ), '[]'::jsonb)
);
$$;

grant execute on function public.fn_social_internal_analytics(int) to authenticated, service_role;