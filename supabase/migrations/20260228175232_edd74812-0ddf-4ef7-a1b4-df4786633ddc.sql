
-- Table: smartops_forms
CREATE TABLE IF NOT EXISTS public.smartops_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  form_purpose text NOT NULL DEFAULT 'captacao'
    CHECK (form_purpose IN ('nps','sdr','roi','cs','captacao','evento')),
  theme_color text DEFAULT '#3b82f6',
  success_message text DEFAULT 'Obrigado! Recebemos suas informações.',
  submissions_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: smartops_form_fields
CREATE TABLE IF NOT EXISTS public.smartops_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.smartops_forms(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text','number','email','phone','radio','select','checkbox','textarea','roi_calculator')),
  db_column text,
  custom_field_name text,
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  placeholder text,
  order_index integer NOT NULL DEFAULT 0,
  roi_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_smartops_forms_slug ON public.smartops_forms(slug);
CREATE INDEX idx_smartops_forms_active ON public.smartops_forms(active);
CREATE INDEX idx_smartops_form_fields_form ON public.smartops_form_fields(form_id);
CREATE INDEX idx_smartops_form_fields_order ON public.smartops_form_fields(form_id, order_index);

-- RLS
ALTER TABLE public.smartops_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartops_form_fields ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all_smartops_forms" ON public.smartops_forms
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "admin_all_smartops_form_fields" ON public.smartops_form_fields
  FOR ALL USING (is_admin(auth.uid()));

-- Anon read active forms
CREATE POLICY "anon_read_active_forms" ON public.smartops_forms
  FOR SELECT USING (active = true);

-- Anon read fields of active forms
CREATE POLICY "anon_read_form_fields" ON public.smartops_form_fields
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.smartops_forms WHERE id = form_id AND active = true)
  );

-- Updated_at triggers
CREATE TRIGGER update_smartops_forms_updated_at
  BEFORE UPDATE ON public.smartops_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_smartops_form_fields_updated_at
  BEFORE UPDATE ON public.smartops_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
