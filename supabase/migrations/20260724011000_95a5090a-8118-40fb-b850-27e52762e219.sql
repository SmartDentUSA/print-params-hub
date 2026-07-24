
CREATE OR REPLACE FUNCTION public.save_produto_alias(
  p_alias_id BIGINT,
  p_nome_variante TEXT,
  p_nome_canonico TEXT,
  p_sku_interno TEXT,
  p_categoria TEXT,
  p_is_kit BOOLEAN
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin: usuário % não tem perfil admin', auth.uid();
  END IF;

  IF p_alias_id IS NOT NULL THEN
    UPDATE public.produto_aliases
       SET nome_variante = COALESCE(p_nome_variante, nome_variante),
           nome_canonico = p_nome_canonico,
           sku_interno   = p_sku_interno,
           categoria     = p_categoria,
           is_kit        = COALESCE(p_is_kit, false),
           ativo         = true
     WHERE id = p_alias_id
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id
    FROM public.produto_aliases
   WHERE lower(nome_variante) = lower(p_nome_variante)
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.produto_aliases
       SET nome_canonico = p_nome_canonico,
           sku_interno   = p_sku_interno,
           categoria     = p_categoria,
           is_kit        = COALESCE(p_is_kit, false),
           ativo         = true
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.produto_aliases (nome_variante, nome_canonico, sku_interno, categoria, is_kit, ativo)
  VALUES (p_nome_variante, p_nome_canonico, p_sku_interno, p_categoria, COALESCE(p_is_kit, false), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_produto_alias(BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_produto_alias(BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
