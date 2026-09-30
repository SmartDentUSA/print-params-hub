DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'smartops_forms_form_purpose_check';
  RAISE NOTICE 'existing: %', def;
END $$;

ALTER TABLE public.smartops_forms DROP CONSTRAINT IF EXISTS smartops_forms_form_purpose_check;
ALTER TABLE public.smartops_forms ADD CONSTRAINT smartops_forms_form_purpose_check
  CHECK (form_purpose IN ('nps','sdr','roi','cs','captacao','evento','sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals','feira_evento','credenciamento'));