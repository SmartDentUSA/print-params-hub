ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS nps_sms_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nps_sms_template text,
  ADD COLUMN IF NOT EXISTS nps_sms_delay_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS nps_sms_max_attempts integer NOT NULL DEFAULT 2;

ALTER TABLE public.smartops_course_enrollments
  ADD COLUMN IF NOT EXISTS nps_sms_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nps_sms_last_sent_at timestamptz;