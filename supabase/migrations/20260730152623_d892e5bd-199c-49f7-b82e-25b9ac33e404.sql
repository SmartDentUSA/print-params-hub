ALTER TABLE public.meta_form_mappings
  DROP CONSTRAINT IF EXISTS meta_form_mappings_stage_formato_chk;

ALTER TABLE public.meta_form_mappings
  ADD CONSTRAINT meta_form_mappings_stage_formato_chk
  CHECK (workflow_stage_target IS NULL
         OR workflow_stage_target ~ '^[1-7]_[a-z0-9_]+__[a-z0-9_]+$');