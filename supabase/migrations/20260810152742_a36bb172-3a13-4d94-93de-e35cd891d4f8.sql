CREATE TABLE public.professional_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_lead_id uuid NOT NULL REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  subtitle text,
  description text,
  modality text NOT NULL DEFAULT 'presencial',
  category text,
  cover_image_url text,
  price_brl numeric,
  promo_price_brl numeric,
  installments integer,
  workload_hours numeric,
  duration_days integer,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  country text DEFAULT 'Brasil',
  state text,
  city text,
  venue text,
  address text,
  online_platform text,
  meeting_link text,
  max_students integer,
  enrolled_count integer NOT NULL DEFAULT 0,
  registration_url text,
  whatsapp_ddi text DEFAULT '55',
  whatsapp_number text,
  instagram text,
  course_platform text,
  video_url text,
  target_audience text,
  prerequisites text,
  syllabus jsonb NOT NULL DEFAULT '[]'::jsonb,
  materials_included text,
  certificate boolean NOT NULL DEFAULT true,
  language text DEFAULT 'pt-BR',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'rascunho',
  public_visible boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  interested_count integer NOT NULL DEFAULT 0,
  created_source text NOT NULL DEFAULT 'admin',
  internal_notes text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_courses TO authenticated;
GRANT ALL ON public.professional_courses TO service_role;

ALTER TABLE public.professional_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage professional courses"
ON public.professional_courses FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_professional_courses_producer ON public.professional_courses(producer_lead_id);
CREATE INDEX idx_professional_courses_status ON public.professional_courses(status);

CREATE TABLE public.professional_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  lead_id uuid NOT NULL REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  uses integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_portal_tokens TO authenticated;
GRANT ALL ON public.professional_portal_tokens TO service_role;

ALTER TABLE public.professional_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage portal tokens"
ON public.professional_portal_tokens FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_professional_portal_tokens_lead ON public.professional_portal_tokens(lead_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_professional_courses_updated_at
BEFORE UPDATE ON public.professional_courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professional_portal_tokens_updated_at
BEFORE UPDATE ON public.professional_portal_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();