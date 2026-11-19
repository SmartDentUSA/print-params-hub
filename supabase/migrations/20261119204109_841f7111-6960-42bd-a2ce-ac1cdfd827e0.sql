ALTER TABLE public.field_capture_sessions
  ADD COLUMN IF NOT EXISTS confirm_step text,
  ADD COLUMN IF NOT EXISTS confirm_edits jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.field_capture_sessions DROP CONSTRAINT IF EXISTS field_capture_sessions_confirm_step_check;
ALTER TABLE public.field_capture_sessions ADD CONSTRAINT field_capture_sessions_confirm_step_check
  CHECK (confirm_step IS NULL OR confirm_step IN ('menu', 'nome', 'telefone', 'email'));