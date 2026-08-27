ALTER TABLE public.smartops_courses DROP CONSTRAINT IF EXISTS smartops_courses_category_check;
ALTER TABLE public.smartops_courses ADD CONSTRAINT smartops_courses_category_check
  CHECK (category IS NULL OR category = ANY (ARRAY['treinamento','imersao','workshop','webinar','live_produtos','avaliacao_pre_instalacao','ativacao_software']));

ALTER TABLE public.smartops_courses DROP CONSTRAINT IF EXISTS smartops_courses_recurrence_type_check;
ALTER TABLE public.smartops_courses ADD CONSTRAINT smartops_courses_recurrence_type_check
  CHECK (recurrence_type IS NULL OR recurrence_type = ANY (ARRAY['days','weeks','months','weekdays']));

ALTER TABLE public.smartops_courses DROP CONSTRAINT IF EXISTS smartops_courses_modality_check;
ALTER TABLE public.smartops_courses ADD CONSTRAINT smartops_courses_modality_check
  CHECK (modality = ANY (ARRAY['presencial','online_ao_vivo','online','acesso_remoto']));