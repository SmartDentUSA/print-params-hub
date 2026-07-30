ALTER TABLE public.post_group_targets
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.post_group_targets.platforms IS 'Redes sociais permitidas para este grupo. Vazio = todas.';

CREATE OR REPLACE VIEW public.v_post_group_targets_detail AS
 SELECT t.id AS target_id,
    t.enabled,
    t.instance_name,
    t.created_at AS adicionado_em,
    g.id AS group_id,
    g.group_jid,
    g.name AS group_name,
    g.tipo,
    g.member_count,
    g.ativo AS group_ativo,
    c.enabled AS instance_enabled,
    c.is_primary,
    t.platforms
   FROM post_group_targets t
     JOIN wa_groups g ON g.id = t.group_id
     JOIN post_group_instance_config c ON c.instance_name = t.instance_name
  WHERE t.enabled = true
  ORDER BY t.instance_name, g.member_count DESC;