CREATE OR REPLACE FUNCTION public.save_produto_alias(
  p_alias_id bigint,
  p_nome_variante text,
  p_nome_canonico text,
  p_sku_interno text,
  p_categoria text,
  p_is_kit boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin: usuário % não tem perfil admin', auth.uid();
  END IF;

  IF p_alias_id IS NOT NULL THEN
    UPDATE public.produto_aliases
       SET nome_canonico = p_nome_canonico,
           sku_interno   = p_sku_interno,
           categoria     = p_categoria,
           is_kit        = COALESCE(p_is_kit, false),
           ativo         = true
     WHERE id = p_alias_id
     RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  SELECT id
    INTO v_id
    FROM public.produto_aliases
   WHERE lower(btrim(nome_variante)) = lower(btrim(p_nome_variante))
   ORDER BY ativo DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
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

  INSERT INTO public.produto_aliases (
    nome_variante,
    nome_canonico,
    sku_interno,
    categoria,
    is_kit,
    ativo
  )
  VALUES (
    btrim(p_nome_variante),
    p_nome_canonico,
    p_sku_interno,
    p_categoria,
    COALESCE(p_is_kit, false),
    true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_produto_alias(bigint, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_produto_alias(bigint, text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_produto_alias(bigint, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_produto_alias(bigint, text, text, text, text, boolean) TO service_role;