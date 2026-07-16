
-- 1. Sequence + column
CREATE SEQUENCE IF NOT EXISTS public.social_posts_blast_seq;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS blast_seq bigint;
CREATE INDEX IF NOT EXISTS idx_social_posts_blast_seq ON public.social_posts(blast_seq);
CREATE INDEX IF NOT EXISTS idx_social_posts_caption_fp ON public.social_posts(caption_fingerprint);

-- 2. Backfill: mesma legenda -> mesmo blast_seq (ordem por created_at do grupo)
WITH grp AS (
  SELECT caption_fingerprint, MIN(created_at) AS first_at
  FROM public.social_posts
  WHERE caption_fingerprint IS NOT NULL
  GROUP BY caption_fingerprint
),
ranked AS (
  SELECT caption_fingerprint,
         ROW_NUMBER() OVER (ORDER BY first_at, caption_fingerprint) AS rn
  FROM grp
),
seq_alloc AS (
  SELECT caption_fingerprint,
         nextval('public.social_posts_blast_seq') AS seq
  FROM ranked
  ORDER BY rn
)
UPDATE public.social_posts sp
SET blast_seq = sa.seq
FROM seq_alloc sa
WHERE sp.caption_fingerprint = sa.caption_fingerprint
  AND sp.blast_seq IS NULL;

-- 3. Trigger BEFORE INSERT: reusa seq p/ mesma fingerprint, senão nextval
CREATE OR REPLACE FUNCTION public.trg_assign_social_post_blast_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE existing bigint;
BEGIN
  IF NEW.blast_seq IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.caption_fingerprint IS NULL OR NEW.caption_fingerprint = '' THEN
    NEW.blast_seq := nextval('public.social_posts_blast_seq');
    RETURN NEW;
  END IF;
  SELECT blast_seq INTO existing
    FROM public.social_posts
   WHERE caption_fingerprint = NEW.caption_fingerprint
     AND blast_seq IS NOT NULL
   ORDER BY blast_seq ASC
   LIMIT 1;
  IF existing IS NOT NULL THEN
    NEW.blast_seq := existing;
  ELSE
    NEW.blast_seq := nextval('public.social_posts_blast_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_social_posts_blast_seq ON public.social_posts;
CREATE TRIGGER trg_social_posts_blast_seq
BEFORE INSERT ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.trg_assign_social_post_blast_seq();

-- 4. Inicializa ponteiro em cron_state com o MAX atual (não re-disparar histórico)
INSERT INTO public.cron_state(key, value, updated_at)
SELECT 'social_auto_blast_last_seq',
       COALESCE(MAX(blast_seq), 0)::text,
       now()
FROM public.social_posts
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();
