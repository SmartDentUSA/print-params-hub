ALTER TABLE public.social_scheduled_posts
  ADD COLUMN IF NOT EXISTS group_blast_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.social_scheduled_posts.group_blast_enabled IS
  'false = a publicação não é enviada automaticamente aos grupos de WhatsApp (social-post-auto-blast). Envio manual em Post Grupos continua liberado.';