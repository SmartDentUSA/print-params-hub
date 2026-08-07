DROP TRIGGER IF EXISTS trg_lia_notify_seller ON public.lia_attendances;
DROP FUNCTION IF EXISTS public.fn_notify_seller_on_lead_assigned();