ALTER TABLE public.lia_automations
  ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT;

UPDATE public.lia_automations
   SET ativo = false, updated_at = now()
 WHERE slug = 'briefing_vendedor';