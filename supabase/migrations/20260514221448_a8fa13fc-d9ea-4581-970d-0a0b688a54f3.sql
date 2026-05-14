ALTER TABLE public.smartops_course_enrollments
  ADD COLUMN IF NOT EXISTS certificate_render_snapshot jsonb;

ALTER TABLE public.smartops_enrollment_companions
  ADD COLUMN IF NOT EXISTS certificate_render_snapshot jsonb;