
UPDATE public.lia_attendances
SET email = ''
WHERE email = 'e-mail não informado';

UPDATE public.lia_attendances
SET area_atuacao = regexp_replace(area_atuacao, '^\d+\s*-\s*', '')
WHERE area_atuacao ~ '^\d+\s*-';

CREATE OR REPLACE FUNCTION public.fn_set_real_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.real_status :=
    CASE
      WHEN NEW.omie_inadimplente = true
        AND COALESCE(NEW.erp_status,'NONE') NOT IN ('CANCELADO','DEVOLVIDO')
        THEN 'INADIMPLENTE'
      WHEN NEW.frete_status IN ('DEVOLVIDO','EXTRAVIADO')
        THEN 'DEAL_PERDIDO'
      WHEN NEW.erp_status IN ('CANCELADO','DEVOLVIDO')
        THEN 'DEAL_PERDIDO'
      WHEN NEW.erp_status = 'INADIMPLENTE'
        THEN 'INADIMPLENTE'
      WHEN NEW.erp_status = 'PAGO'
        AND COALESCE(NEW.frete_status,'NONE') IN ('ENTREGUE','NONE')
        THEN 'CLIENTE_ATIVO'
      WHEN NEW.erp_status = 'PAGO'
        AND COALESCE(NEW.frete_status,'NONE') NOT IN ('ENTREGUE','NONE')
        THEN 'AGUARDANDO_ENTREGA'
      WHEN NEW.frete_status = 'EM_TRANSITO'
        THEN 'EM_TRANSITO'
      WHEN NEW.erp_status IN ('FATURADO','PARCIALMENTE_PAGO')
        THEN 'AGUARDANDO_PAGAMENTO'
      WHEN NEW.status_oportunidade = 'ganha'
        AND (NEW.erp_status IS NULL OR NEW.erp_status = 'NONE')
        AND COALESCE(NEW.ltv_total, 0) > 50000
        AND COALESCE(NEW.omie_faturamento_total, 0) = 0
        THEN 'CLIENTE_ATIVO'
      WHEN NEW.status_oportunidade = 'ganha'
        AND (NEW.erp_status IS NULL OR NEW.erp_status = 'NONE')
        THEN 'RISCO_OPERACIONAL'
      WHEN NEW.status_oportunidade = 'perdida'
        THEN 'NEGOCIO_PERDIDO'
      ELSE 'EM_NEGOCIACAO'
    END;
  RETURN NEW;
END;
$function$;

UPDATE public.lia_attendances
SET updated_at = now()
WHERE id = '2b3d6f4c-40e4-4c6e-a848-3c121e9564e4';
