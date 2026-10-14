ALTER TABLE public.kol_commission_template_items ADD COLUMN IF NOT EXISTS coupon_discount_percent numeric;
CREATE UNIQUE INDEX IF NOT EXISTS kol_commission_template_items_key ON public.kol_commission_template_items (template_id, kind, coalesce(category,''), coalesce(subcategory,''), coalesce(product_id,''));
ALTER TABLE public.kol_contracts ADD COLUMN IF NOT EXISTS commission_addendum_accepted_at timestamptz;

GRANT SELECT ON public.kol_commission_templates, public.kol_commission_template_items TO authenticated;
CREATE POLICY "staff read kol commission templates" ON public.kol_commission_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff read kol commission items" ON public.kol_commission_template_items FOR SELECT TO authenticated USING (true);

-- Linhas do padrão no formato de prof_kol_commissions (cópia, não vínculo)
CREATE OR REPLACE FUNCTION public.fn_kol_default_commission_rows(_from date DEFAULT current_date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', case when i.kind = 'produto' then 'product' else 'category' end,
    'category', i.category, 'subcategory', i.subcategory,
    'product_id', coalesce(i.product_id,''),
    'product_name', coalesce(case when i.kind='produto' then i.product_id end,
                     case when i.subcategory is not null then i.category||' › '||i.subcategory else i.category end),
    'percent', i.percent, 'coupon_discount_percent', i.coupon_discount_percent,
    'active_from', _from, 'source', 'padrao') order by i.category, i.subcategory), '[]'::jsonb)
  from kol_commission_template_items i join kol_commission_templates t on t.id = i.template_id and t.is_default
$$;
GRANT EXECUTE ON FUNCTION public.fn_kol_default_commission_rows(date) TO authenticated, service_role;

-- Ao virar KOL: acrescenta as linhas do padrão que ainda não existem
CREATE OR REPLACE FUNCTION public.fn_trg_lia_kol_zdefaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_rows jsonb; v_cur jsonb;
begin
  if NEW.is_kol and (TG_OP = 'INSERT' or not coalesce(OLD.is_kol,false)) then
    v_cur := case when jsonb_typeof(NEW.prof_kol_commissions)='array' then NEW.prof_kol_commissions else '[]'::jsonb end;
    select coalesce(jsonb_agg(d), '[]'::jsonb) into v_rows
    from jsonb_array_elements(public.fn_kol_default_commission_rows(current_date)) d
    where not exists (select 1 from jsonb_array_elements(v_cur) c
      where coalesce(c->>'kind','product') = d->>'kind'
        and coalesce(c->>'category','') = coalesce(d->>'category','')
        and coalesce(c->>'subcategory','') = coalesce(d->>'subcategory','')
        and coalesce(c->>'product_id','') = coalesce(d->>'product_id',''));
    NEW.prof_kol_commissions := v_cur || v_rows;
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_lia_kol_zdefaults ON public.lia_attendances;
CREATE TRIGGER trg_lia_kol_zdefaults BEFORE INSERT OR UPDATE OF prof_kol_form_ids, prof_kol_commissions, prof_kol_coupons ON public.lia_attendances
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_lia_kol_zdefaults();

-- Contrato aceito: comissão só muda com aditivo aceito
CREATE OR REPLACE FUNCTION public.fn_trg_lia_kol_commission_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if NEW.prof_kol_commissions is distinct from OLD.prof_kol_commissions and exists (
    select 1 from kol_contracts k where k.lead_id = NEW.id and k.signed_at is not null and k.revoked_at is null
      and (k.commission_addendum_accepted_at is null or k.commission_addendum_accepted_at < now() - interval '1 day')) then
    raise exception 'Contrato KOL já aceito: alteração de comissão exige aditivo de comissionamento aceito.';
  end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_lia_kol_commission_guard ON public.lia_attendances;
CREATE TRIGGER trg_lia_kol_commission_guard BEFORE UPDATE OF prof_kol_commissions ON public.lia_attendances
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_lia_kol_commission_guard();

CREATE OR REPLACE FUNCTION public.fn_kol_commission_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prof_kol_commissions IS DISTINCT FROM OLD.prof_kol_commissions THEN
    PERFORM public.fn_kol_log(NEW.id, 'kol_commission_changed', 'kol_commission', NEW.id::text, 'Regras de comissão',
      jsonb_build_object('before', OLD.prof_kol_commissions, 'after', NEW.prof_kol_commissions), NULL, 'sistema');
  END IF;
  RETURN NEW;
END $$;