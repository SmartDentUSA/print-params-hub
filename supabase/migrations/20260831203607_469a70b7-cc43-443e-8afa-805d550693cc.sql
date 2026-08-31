ALTER TABLE public.smartops_courses ADD COLUMN IF NOT EXISTS marketing_briefing text;
ALTER TABLE public.smartops_course_turmas ADD COLUMN IF NOT EXISTS live_thumbnail_copy jsonb;