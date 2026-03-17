
-- ═══════════════════════════════════════════════════
-- STEP 1: marketing_assets table
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('landing_page','blog_post','social_post','email_template','whatsapp_template','video','infographic','case_study')),
  title TEXT NOT NULL,
  slug TEXT,
  url TEXT,
  content_html TEXT,
  content_json JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published','archived')),
  source_system TEXT NOT NULL DEFAULT 'sistema_a',
  source_id TEXT,
  related_product_ids TEXT[],
  related_lead_segments TEXT[],
  campaign_id TEXT,
  campaign_name TEXT,
  performance_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_assets_type ON public.marketing_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_status ON public.marketing_assets(status);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_source ON public.marketing_assets(source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_campaign ON public.marketing_assets(campaign_id);

ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on marketing_assets"
ON public.marketing_assets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated read on marketing_assets"
ON public.marketing_assets FOR SELECT
TO authenticated
USING (true);

-- ═══════════════════════════════════════════════════
-- STEP 2: whatsapp_templates table
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_category TEXT NOT NULL DEFAULT 'utility' CHECK (template_category IN ('utility','marketing','authentication')),
  language_code TEXT NOT NULL DEFAULT 'pt_BR',
  header_type TEXT CHECK (header_type IN ('text','image','video','document')),
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB,
  variables TEXT[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','paused')),
  source_system TEXT NOT NULL DEFAULT 'sistema_a',
  source_id TEXT,
  related_product_ids TEXT[],
  performance_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE(template_name, language_code)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON public.whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_wa_templates_category ON public.whatsapp_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_wa_templates_source ON public.whatsapp_templates(source_system, source_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_templates"
ON public.whatsapp_templates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated read on whatsapp_templates"
ON public.whatsapp_templates FOR SELECT
TO authenticated
USING (true);

-- ═══════════════════════════════════════════════════
-- STEP 3: lead_enrichment_audit table
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.lead_enrichment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  source TEXT NOT NULL,
  source_priority INT DEFAULT 10,
  fields_updated TEXT[] NOT NULL DEFAULT '{}',
  previous_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_audit_lead ON public.lead_enrichment_audit(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_source ON public.lead_enrichment_audit(source);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_ts ON public.lead_enrichment_audit(timestamp DESC);

ALTER TABLE public.lead_enrichment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_enrichment_audit"
ON public.lead_enrichment_audit FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated read on lead_enrichment_audit"
ON public.lead_enrichment_audit FOR SELECT
TO authenticated
USING (true);

-- ═══════════════════════════════════════════════════
-- STEP 4: DB function for tag merge (used by sellflux-webhook)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.merge_tags_crm(p_lead_id UUID, p_new_tags TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE lia_attendances
  SET tags_crm = (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(COALESCE(tags_crm, '{}') || p_new_tags) AS unnest
      ORDER BY unnest
    )
  ),
  updated_at = now()
  WHERE id = p_lead_id;
END;
$$;

-- ═══════════════════════════════════════════════════
-- STEP 5: updated_at triggers
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_assets_updated_at
BEFORE UPDATE ON public.marketing_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
