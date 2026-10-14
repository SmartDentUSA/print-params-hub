ALTER TABLE public.kol_commission_template_items ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'cupom';
UPDATE public.kol_commission_template_items SET channel='indicacao' WHERE kind='indicacao';

CREATE OR REPLACE FUNCTION public.fn_kol_template_item_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.channel NOT IN ('indicacao','cupom','formulario') THEN RAISE EXCEPTION 'Canal inválido: %', NEW.channel; END IF;
  IF NEW.channel <> 'cupom' THEN NEW.coupon_discount_percent := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_kol_template_item_validate ON public.kol_commission_template_items;
CREATE TRIGGER trg_kol_template_item_validate BEFORE INSERT OR UPDATE ON public.kol_commission_template_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_kol_template_item_validate();

CREATE OR REPLACE FUNCTION public.fn_kol_default_commission_rows(_from date DEFAULT CURRENT_DATE)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', case when i.kind = 'produto' then 'product' when i.kind = 'indicacao' then 'referral' else 'category' end,
    'channel', i.channel,
    'category', i.category, 'subcategory', i.subcategory,
    'product_id', coalesce(i.product_id,''),
    'product_name', case when i.kind = 'indicacao' then 'Comissão por indicação'
                     else coalesce(case when i.kind='produto' then i.product_id end,
                     case when i.subcategory is not null then i.category||' › '||i.subcategory else i.category end) end,
    'percent', i.percent, 'coupon_discount_percent', i.coupon_discount_percent,
    'active_from', _from, 'source', 'padrao') order by i.channel, i.category, i.subcategory), '[]'::jsonb)
  from kol_commission_template_items i join kol_commission_templates t on t.id = i.template_id and t.is_default
$function$;