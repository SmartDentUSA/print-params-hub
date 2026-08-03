CREATE OR REPLACE FUNCTION public.painel_nome_norm(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(trim(translate(coalesce(p_nome,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')))
$$;

CREATE OR REPLACE FUNCTION public.painel_vendedores_ativos()
RETURNS TABLE(nome_norm text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.painel_nome_norm(tm.nome_completo)
  FROM public.team_members tm
  WHERE tm.ativo IS TRUE AND tm.nome_completo IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.painel_filtrar_ativos(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN p_payload
    WHEN NOT EXISTS (SELECT 1 FROM public.painel_vendedores_ativos()) THEN p_payload
    ELSE coalesce((
      SELECT jsonb_agg(e ORDER BY ord)
      FROM jsonb_array_elements(p_payload) WITH ORDINALITY t(e, ord)
      WHERE public.painel_nome_norm(e->>'vendedor') IN (
        SELECT nome_norm FROM public.painel_vendedores_ativos()
      )
    ), '[]'::jsonb)
  END
$$;

CREATE OR REPLACE FUNCTION public.painel_comercial_vendedores(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.painel_filtrar_ativos(public.painel_comercial_bloco('vendedores', p_mes))
$$;

CREATE OR REPLACE FUNCTION public.painel_comercial_atividades(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.painel_filtrar_ativos(public.painel_comercial_bloco('atividades', p_mes))
$$;

GRANT EXECUTE ON FUNCTION public.painel_nome_norm(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_vendedores(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_atividades(date) TO anon, authenticated;