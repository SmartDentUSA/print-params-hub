ALTER TABLE public.field_capture_sessions ADD COLUMN IF NOT EXISTS subtype text;
ALTER TABLE public.field_capture_sessions ADD CONSTRAINT field_capture_sessions_subtype_check CHECK (subtype IS NULL OR subtype IN ('venda_direta','padrao','distribuidor','oportunidade'));
ALTER TABLE public.field_capture_sessions DROP CONSTRAINT field_capture_sessions_confirm_step_check;
ALTER TABLE public.field_capture_sessions ADD CONSTRAINT field_capture_sessions_confirm_step_check CHECK (confirm_step IS NULL OR confirm_step IN ('menu','nome','telefone','email','subtype'));