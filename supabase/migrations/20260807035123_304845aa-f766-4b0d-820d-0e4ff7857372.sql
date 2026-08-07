WITH novo AS (
  SELECT 'Olá! 👋
Seja bem-vindo(a) à SmartDent!
Obrigado por nos seguir. 😊'::text AS msg
)
UPDATE public.social_flows sf
SET zernio_automation_config = jsonb_set(coalesce(sf.zernio_automation_config,'{}'::jsonb), '{message}', to_jsonb((SELECT msg FROM novo))),
    nodes = (
      SELECT jsonb_agg(
        CASE WHEN n->>'type' = 'send_dm'
          THEN jsonb_set(n, '{message}', to_jsonb((SELECT msg FROM novo)))
          ELSE n END
      )
      FROM jsonb_array_elements(sf.nodes) n
    ),
    updated_at = now()
WHERE sf.id = 'a1b2c3d4-0021-0021-0021-000000000021';