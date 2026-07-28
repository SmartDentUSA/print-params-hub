CREATE TABLE public.meta_form_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id TEXT NOT NULL UNIQUE,
  form_name_meta TEXT,
  origin_system_b TEXT,
  product_name TEXT,
  product_catalog_id UUID REFERENCES public.system_a_catalog(id) ON DELETE SET NULL,
  workflow_stage_target TEXT,
  commercial_eligible BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  last_lead_at TIMESTAMPTZ,
  leads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

COMMENT ON COLUMN public.meta_form_mappings.product_name IS 'Rótulo livre de exibição. Quando product_catalog_id está preenchido, o catálogo prevalece para lógica de negócio.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_form_mappings TO authenticated;
GRANT ALL ON public.meta_form_mappings TO service_role;

ALTER TABLE public.meta_form_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_form_mappings_read_authenticated"
  ON public.meta_form_mappings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "meta_form_mappings_admin_insert"
  ON public.meta_form_mappings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "meta_form_mappings_admin_update"
  ON public.meta_form_mappings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "meta_form_mappings_admin_delete"
  ON public.meta_form_mappings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_meta_form_mappings_unmapped ON public.meta_form_mappings (active) WHERE product_catalog_id IS NULL AND product_name IS NULL;

CREATE OR REPLACE FUNCTION public.fn_meta_form_mappings_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_form_mappings_audit
  BEFORE INSERT OR UPDATE ON public.meta_form_mappings
  FOR EACH ROW EXECUTE FUNCTION public.fn_meta_form_mappings_audit();