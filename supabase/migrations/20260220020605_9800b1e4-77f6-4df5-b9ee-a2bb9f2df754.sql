CREATE TABLE public.knowledge_gap_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_title           TEXT NOT NULL,
  draft_excerpt         TEXT NOT NULL,
  draft_faq             JSONB,
  draft_keywords        TEXT[],
  gap_ids               UUID[] NOT NULL,
  cluster_questions     TEXT[] NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  published_content_id  UUID,
  created_at            TIMESTAMPTZ DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           TEXT
);

ALTER TABLE public.knowledge_gap_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gap drafts"
  ON public.knowledge_gap_drafts FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));