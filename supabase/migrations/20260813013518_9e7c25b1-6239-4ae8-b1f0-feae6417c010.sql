create or replace function public.fn_log_sms_response_to_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is null then return new; end if;
  insert into public.lead_activity_log (
    lead_id, event_type, event_timestamp, source_channel,
    entity_type, entity_id, entity_name, event_data
  ) values (
    new.lead_id,
    'sms_resposta',
    coalesce(new.created_at, now()),
    'sms',
    'sms_response',
    new.id::text,
    'Resposta de SMS',
    jsonb_build_object(
      'kind', 'sms',
      'kind_label', 'Resposta de SMS',
      'icon', '💬',
      'mensagem', new.resposta,
      'telefone', new.telefone,
      'intencao', new.intencao,
      'campaign_id', new.campaign_id,
      'fonte', 'campaign_sms_responses'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_log_sms_response_to_timeline on public.campaign_sms_responses;
create trigger trg_log_sms_response_to_timeline
after insert on public.campaign_sms_responses
for each row execute function public.fn_log_sms_response_to_timeline();

-- backfill das respostas já recebidas
insert into public.lead_activity_log (lead_id, event_type, event_timestamp, source_channel, entity_type, entity_id, entity_name, event_data)
select r.lead_id, 'sms_resposta', coalesce(r.created_at, now()), 'sms', 'sms_response', r.id::text, 'Resposta de SMS',
  jsonb_build_object('kind','sms','kind_label','Resposta de SMS','icon','💬','mensagem',r.resposta,'telefone',r.telefone,'intencao',r.intencao,'campaign_id',r.campaign_id,'fonte','campaign_sms_responses')
from public.campaign_sms_responses r
where r.lead_id is not null
  and not exists (
    select 1 from public.lead_activity_log l
    where l.lead_id = r.lead_id and l.event_type = 'sms_resposta' and l.entity_id = r.id::text
  );