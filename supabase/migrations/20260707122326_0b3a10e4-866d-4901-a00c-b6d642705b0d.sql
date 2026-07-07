ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS auto_blast_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_auto_blast_pending ON public.social_posts (created_at) WHERE auto_blast_at IS NULL;
-- Backfill: marca todos os posts existentes como já processados para não disparar histórico em massa.
UPDATE public.social_posts SET auto_blast_at = COALESCE(created_at, now()) WHERE auto_blast_at IS NULL;