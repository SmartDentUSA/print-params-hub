ALTER TABLE public.smartops_course_enrollments
  ADD COLUMN IF NOT EXISTS cs_team_member_id uuid,
  ADD COLUMN IF NOT EXISTS wa_reminder_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS wa_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS wa_reminder_error text;

CREATE INDEX IF NOT EXISTS idx_enrollments_wa_reminder_due
  ON public.smartops_course_enrollments (wa_reminder_scheduled_for)
  WHERE wa_reminder_sent_at IS NULL AND wa_reminder_scheduled_for IS NOT NULL;