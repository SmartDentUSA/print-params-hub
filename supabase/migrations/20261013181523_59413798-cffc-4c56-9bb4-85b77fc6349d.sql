CREATE OR REPLACE FUNCTION public.fn_kol_log(_lead_id uuid, _event_type text, _entity_type text, _entity_id text, _entity_name text, _data jsonb, _value numeric DEFAULT NULL::numeric, _channel text DEFAULT 'kol'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_key text; v_actor text; v_data jsonb; v_hash text; v_id uuid; v_ts timestamptz;
begin
  if _lead_id is null or coalesce(_event_type,'') = '' then
    raise exception 'fn_kol_log: lead_id e event_type obrigatórios';
  end if;
  v_key := coalesce(_data->>'dedupe_key', _event_type||':'||coalesce(_entity_id,'')||':'||_lead_id::text);
  v_actor := coalesce(case when auth.uid() is not null then 'equipe:'||auth.uid()::text end,
                      nullif(_data->>'actor',''), 'sistema');
  v_ts := coalesce(nullif(_data->>'event_timestamp','')::timestamptz, now());
  v_data := coalesce(_data,'{}'::jsonb) || jsonb_build_object('dedupe_key', v_key, 'actor', v_actor);
  v_hash := md5(_event_type||coalesce(_entity_id,'')||v_key);

  -- O gatilho de deduplicação descarta INSERT repetido em silêncio (ON CONFLICT não dispara),
  -- então a atualização do evento existente precisa ser explícita.
  update public.lead_activity_log
     set event_data = v_data, entity_name = _entity_name, value_numeric = _value, entity_type = _entity_type
   where lead_id = _lead_id and event_type = _event_type and dedupe_hash = v_hash
  returning id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.lead_activity_log(lead_id, event_type, entity_type, entity_id, entity_name,
    event_timestamp, event_data, value_numeric, source_channel, dedupe_hash)
  values (_lead_id, _event_type, _entity_type, _entity_id, _entity_name, v_ts, v_data, _value,
    coalesce(_channel,'kol'), v_hash)
  returning id into v_id;
  return v_id;
end $function$;