
ALTER TABLE public.smartops_course_turmas
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_url text,
  ADD COLUMN IF NOT EXISTS drive_folder_name text,
  ADD COLUMN IF NOT EXISTS drive_folder_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_subfolders jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_docx_file_id text,
  ADD COLUMN IF NOT EXISTS drive_descricao_file_id text;
