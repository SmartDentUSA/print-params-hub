DROP TRIGGER IF EXISTS trg_sdr_voice_on_seller_assign ON public.lia_attendances;
DROP FUNCTION IF EXISTS public.fn_trigger_sdr_voice_on_assign();
ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_api_key;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_instance_name;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_phone_number;