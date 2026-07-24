ALTER TABLE public.lia_attendances 
  ADD COLUMN IF NOT EXISTS prof_qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prof_university_roles jsonb NOT NULL DEFAULT '[]'::jsonb;