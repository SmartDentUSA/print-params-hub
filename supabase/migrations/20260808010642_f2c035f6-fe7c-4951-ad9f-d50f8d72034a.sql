ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS wa_instance_name text,
  ADD COLUMN IF NOT EXISTS reminder_message_template text,
  ADD COLUMN IF NOT EXISTS nps_message_template text;