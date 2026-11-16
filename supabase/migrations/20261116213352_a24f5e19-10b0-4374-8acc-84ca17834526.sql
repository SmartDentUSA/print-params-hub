ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS lojaintegrada_produtos_comprados text[];
CREATE INDEX IF NOT EXISTS idx_lia_li_produtos_comprados ON public.lia_attendances USING gin (lojaintegrada_produtos_comprados);

CREATE OR REPLACE FUNCTION public.fn_li_refresh_lead_products(p_lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH targets AS (
    SELECT DISTINCT COALESCE(l.merged_into, l.id) AS canon
    FROM lia_attendances l
    WHERE l.id = ANY(p_lead_ids)
  ), members AS (
    SELECT t.canon, l2.id AS member_id, l2.lojaintegrada_itens_json, l2.lojaintegrada_ultimo_pedido_status
    FROM targets t
    JOIN lia_attendances l2 ON (l2.id = t.canon OR l2.merged_into = t.canon)
  ), from_orders AS (
    SELECT m.canon, NULLIF(btrim(COALESCE(i.nome_canonico, i.nome_produto)), '') AS nm
    FROM members m
    JOIN loja_integrada_orders o ON o.attendance_id = m.member_id
      AND COALESCE(o.status, '') <> 'Pedido Cancelado'
    JOIN loja_integrada_order_items i ON i.order_id = o.id
  ), from_last AS (
    SELECT m.canon, NULLIF(btrim(it->>'nome'), '') AS nm
    FROM members m
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(m.lojaintegrada_itens_json) = 'array' THEN m.lojaintegrada_itens_json ELSE '[]'::jsonb END
    ) it
    WHERE COALESCE(m.lojaintegrada_ultimo_pedido_status, '') <> 'Pedido Cancelado'
      AND NOT EXISTS (SELECT 1 FROM from_orders fo WHERE fo.canon = m.canon)
  ), agg AS (
    SELECT t.canon,
      (SELECT array_agg(DISTINCT x.nm ORDER BY x.nm)
         FROM (SELECT nm FROM from_orders WHERE canon = t.canon
               UNION SELECT nm FROM from_last WHERE canon = t.canon) x
        WHERE x.nm IS NOT NULL) AS prods
    FROM targets t
  )
  UPDATE lia_attendances la
     SET lojaintegrada_produtos_comprados = agg.prods
    FROM agg
   WHERE la.id = agg.canon
     AND la.lojaintegrada_produtos_comprados IS DISTINCT FROM agg.prods;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_li_refresh_lead_products(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_li_refresh_lead_products(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_li_items_refresh_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ids uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT o.attendance_id) INTO v_ids
      FROM old_rows r JOIN loja_integrada_orders o ON o.id = r.order_id
     WHERE o.attendance_id IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT o.attendance_id) INTO v_ids
      FROM new_rows r JOIN loja_integrada_orders o ON o.id = r.order_id
     WHERE o.attendance_id IS NOT NULL;
  END IF;
  IF v_ids IS NOT NULL THEN PERFORM public.fn_li_refresh_lead_products(v_ids); END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_li_items_refresh_products: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_li_orders_refresh_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v_ids FROM (
    SELECT n.attendance_id AS x FROM new_rows n JOIN old_rows o ON o.id = n.id
     WHERE n.attendance_id IS DISTINCT FROM o.attendance_id OR n.status IS DISTINCT FROM o.status
    UNION
    SELECT o.attendance_id FROM new_rows n JOIN old_rows o ON o.id = n.id
     WHERE n.attendance_id IS DISTINCT FROM o.attendance_id
  ) s WHERE x IS NOT NULL;
  IF v_ids IS NOT NULL THEN PERFORM public.fn_li_refresh_lead_products(v_ids); END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_li_orders_refresh_products: %', SQLERRM;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_li_items_refresh_products() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_li_orders_refresh_products() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_li_items_products_ins ON public.loja_integrada_order_items;
CREATE TRIGGER trg_li_items_products_ins AFTER INSERT ON public.loja_integrada_order_items
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.fn_li_items_refresh_products();
DROP TRIGGER IF EXISTS trg_li_items_products_upd ON public.loja_integrada_order_items;
CREATE TRIGGER trg_li_items_products_upd AFTER UPDATE ON public.loja_integrada_order_items
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.fn_li_items_refresh_products();
DROP TRIGGER IF EXISTS trg_li_items_products_del ON public.loja_integrada_order_items;
CREATE TRIGGER trg_li_items_products_del AFTER DELETE ON public.loja_integrada_order_items
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.fn_li_items_refresh_products();
DROP TRIGGER IF EXISTS trg_li_orders_products_upd ON public.loja_integrada_orders;
CREATE TRIGGER trg_li_orders_products_upd AFTER UPDATE ON public.loja_integrada_orders
  REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.fn_li_orders_refresh_products();

-- Backfill: clientes com pedidos ou itens do último pedido
SELECT public.fn_li_refresh_lead_products(ARRAY(
  SELECT DISTINCT attendance_id FROM public.loja_integrada_orders WHERE attendance_id IS NOT NULL
  UNION
  SELECT id FROM public.lia_attendances
   WHERE jsonb_typeof(lojaintegrada_itens_json) = 'array' AND jsonb_array_length(lojaintegrada_itens_json) > 0
));