ALTER TABLE public.knowledge_contents
  ADD COLUMN IF NOT EXISTS hero_audio_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS hero_audio_label TEXT NULL;