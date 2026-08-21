ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS ig_trigger_keyword TEXT,
  ADD COLUMN IF NOT EXISTS ig_trigger_cta TEXT,
  ADD COLUMN IF NOT EXISTS ig_trigger_dm_message TEXT,
  ADD COLUMN IF NOT EXISTS ig_trigger_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS smartops_forms_ig_trigger_keyword_uniq
  ON public.smartops_forms (upper(ig_trigger_keyword))
  WHERE ig_trigger_keyword IS NOT NULL AND ig_trigger_enabled;