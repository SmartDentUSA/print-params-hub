create or replace function public.fn_wa_group_campaign_stats(p_ids uuid[])
returns table(campaign_id uuid, groups integer, total integer, sent integer, pending integer, failed integer, skipped integer, last_sent_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select q.campaign_id,
         count(distinct q.group_jid)::int,
         count(*)::int,
         count(*) filter (where q.status = 'sent')::int,
         count(*) filter (where q.status in ('pending','sending','blocked_session'))::int,
         count(*) filter (where q.status = 'failed')::int,
         count(*) filter (where q.status = 'skipped')::int,
         max(q.sent_at)
  from public.wa_message_queue q
  where q.campaign_id = any(p_ids)
  group by q.campaign_id
$$;
grant execute on function public.fn_wa_group_campaign_stats(uuid[]) to authenticated, service_role;