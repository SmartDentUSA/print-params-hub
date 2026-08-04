CREATE TABLE public.training_testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id uuid NOT NULL REFERENCES public.smartops_course_turmas(id) ON DELETE CASCADE,
  course_id uuid,
  media_id uuid REFERENCES public.training_drive_media(id) ON DELETE SET NULL,
  drive_file_id text NOT NULL,
  drive_folder_id text,
  drive_web_view_link text,
  generated_filename text,
  video_sha256 text,
  video_size_bytes bigint,
  mime_type text,
  enrollment_id uuid REFERENCES public.smartops_course_enrollments(id) ON DELETE SET NULL,
  companion_id uuid REFERENCES public.smartops_enrollment_companions(id) ON DELETE SET NULL,
  participant_name text,
  participant_type text,
  participant_snapshot jsonb,
  language text,
  duration_seconds numeric,
  transcript_raw text,
  transcript_revised text,
  transcript_segments jsonb,
  transcription_confidence numeric,
  low_confidence_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcription_model text,
  transcribed_at timestamptz,
  analysis jsonb,
  rag_context_snapshot jsonb,
  knowledge_content_id uuid REFERENCES public.knowledge_contents(id) ON DELETE SET NULL,
  knowledge_slug text,
  public_url text,
  video_provider text,
  video_provider_id text,
  video_embed_url text,
  video_publish_status text,
  video_publish_error text,
  video_published_at timestamptz,
  sitemap_pinged_at timestamptz,
  rag_indexed_at timestamptz,
  rag_chunks integer NOT NULL DEFAULT 0,
  social_kit_run_id uuid,
  status text NOT NULL DEFAULT 'uploaded',
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_notes text,
  version integer NOT NULL DEFAULT 1,
  processed_by uuid,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_testimonials_drive_file_uk UNIQUE (drive_file_id),
  CONSTRAINT training_testimonials_status_chk CHECK (status IN (
    'uploaded','awaiting_identification','transcribing','transcribed','generating',
    'validation_failed','pending_review','publishing','published','indexing','indexed',
    'rag_available','failed'
  )),
  CONSTRAINT training_testimonials_participant_type_chk CHECK (
    participant_type IS NULL OR participant_type IN ('enrollment','companion')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_testimonials TO authenticated;
GRANT ALL ON public.training_testimonials TO service_role;

ALTER TABLE public.training_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores de mídia de treinamento gerenciam depoimentos"
ON public.training_testimonials FOR ALL TO authenticated
USING (public.can_manage_training_media(auth.uid()))
WITH CHECK (public.can_manage_training_media(auth.uid()));

CREATE INDEX idx_training_testimonials_turma ON public.training_testimonials(turma_id);
CREATE INDEX idx_training_testimonials_status ON public.training_testimonials(status);
CREATE INDEX idx_training_testimonials_content ON public.training_testimonials(knowledge_content_id);

CREATE TABLE public.training_testimonial_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  testimonial_id uuid NOT NULL REFERENCES public.training_testimonials(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL,
  message text,
  details jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_testimonial_events TO authenticated;
GRANT ALL ON public.training_testimonial_events TO service_role;

ALTER TABLE public.training_testimonial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores de mídia de treinamento leem eventos de depoimento"
ON public.training_testimonial_events FOR SELECT TO authenticated
USING (public.can_manage_training_media(auth.uid()));

CREATE INDEX idx_training_testimonial_events_testimonial
ON public.training_testimonial_events(testimonial_id, created_at DESC);

CREATE TRIGGER trg_training_testimonials_updated_at
BEFORE UPDATE ON public.training_testimonials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();