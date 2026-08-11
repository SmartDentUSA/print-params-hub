DROP TRIGGER IF EXISTS trg_briefing_vendedor_imediato ON public.lia_attendances;
DROP TRIGGER IF EXISTS trg_briefing_notify_seller ON public.lia_attendances;
DROP FUNCTION IF EXISTS public.fn_trigger_briefing_vendedor_imediato();
DROP FUNCTION IF EXISTS public.fn_trigger_briefing_notify_seller();