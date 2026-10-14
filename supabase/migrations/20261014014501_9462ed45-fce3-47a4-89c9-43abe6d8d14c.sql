CREATE OR REPLACE FUNCTION public.fn_trg_lia_kol_zdefaults()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_rows jsonb; v_cur jsonb;
begin
  if NEW.is_kol and (TG_OP = 'INSERT' or not coalesce(OLD.is_kol,false)) then
    v_cur := case when jsonb_typeof(NEW.prof_kol_commissions)='array' then NEW.prof_kol_commissions else '[]'::jsonb end;
    select coalesce(jsonb_agg(d), '[]'::jsonb) into v_rows
    from jsonb_array_elements(public.fn_kol_default_commission_rows(current_date)) d
    where not exists (select 1 from jsonb_array_elements(v_cur) c
      where coalesce(c->>'channel', case when c->>'kind'='referral' then 'indicacao' else 'cupom' end) = d->>'channel'
        and coalesce(c->>'kind','product') = d->>'kind'
        and coalesce(c->>'category','') = coalesce(d->>'category','')
        and coalesce(c->>'subcategory','') = coalesce(d->>'subcategory','')
        and coalesce(c->>'product_id','') = coalesce(d->>'product_id',''));
    NEW.prof_kol_commissions := v_cur || v_rows;
  end if;
  return NEW;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_trg_lia_kol_defaults_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if NEW.is_kol and (TG_OP = 'INSERT' or not coalesce(OLD.is_kol,false)) then
    perform public.fn_kol_log(NEW.id, 'kol_commission_defaults_copied', 'kol_commission', NEW.id::text,
      'Comissão padrão copiada', jsonb_build_object('rows', NEW.prof_kol_commissions), NULL, 'sistema');
  end if;
  return NEW;
end $function$;
REVOKE EXECUTE ON FUNCTION public.fn_trg_lia_kol_defaults_log() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_lia_kol_defaults_log ON public.lia_attendances;
CREATE TRIGGER trg_lia_kol_defaults_log AFTER INSERT OR UPDATE OF prof_kol_form_ids, prof_kol_commissions, prof_kol_coupons
  ON public.lia_attendances FOR EACH ROW EXECUTE FUNCTION public.fn_trg_lia_kol_defaults_log();

SELECT public.fn_kol_log('504f2099-97c3-4c18-88b4-2ca8676399a9'::uuid, 'kol_commission_defaults_copied', 'kol_commission',
  '504f2099-97c3-4c18-88b4-2ca8676399a9', 'Comissão padrão copiada',
  jsonb_build_object('rows', (select prof_kol_commissions from public.lia_attendances where id='504f2099-97c3-4c18-88b4-2ca8676399a9')), NULL, 'sistema');