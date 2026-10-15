UPDATE social_flows SET
  nodes = jsonb_build_array(
    jsonb_build_object('id','dm','type','default','position',jsonb_build_object('x',120,'y',80),
      'data', jsonb_build_object('label','DM com link — ' || split_part(name,' — ',2),'nodeType','send_dm','config',jsonb_build_object('message', zernio_automation_config->>'dm_message'))),
    jsonb_build_object('id','end','type','default','position',jsonb_build_object('x',120,'y',240),
      'data', jsonb_build_object('label','Fim','nodeType','end','config','{}'::jsonb))
  ),
  edges = jsonb_build_array(jsonb_build_object('id','e-dm-end','source','dm','target','end')),
  updated_at = now()
WHERE (nodes IS NULL OR nodes = '[]'::jsonb)
  AND zernio_automation_config ? 'dm_message';