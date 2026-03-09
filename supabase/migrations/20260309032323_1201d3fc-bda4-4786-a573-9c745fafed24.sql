
-- 1. New table: roi_card_items (combo products)
CREATE TABLE roi_card_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roi_card_id UUID NOT NULL REFERENCES roi_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  investimento_fora_combo NUMERIC DEFAULT 0,
  investimento_com_combo NUMERIC DEFAULT 0,
  economia_imediata NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roi_card_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read roi_card_items"
  ON roi_card_items FOR SELECT USING (true);

CREATE POLICY "Admins can manage roi_card_items"
  ON roi_card_items FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- 2. New table: roi_card_cad_types (CAD comparison by procedure)
CREATE TABLE roi_card_cad_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roi_card_id UUID NOT NULL REFERENCES roi_cards(id) ON DELETE CASCADE,
  procedure_name TEXT NOT NULL DEFAULT '',
  cad_manual_time NUMERIC DEFAULT 0,
  cad_manual_cost NUMERIC DEFAULT 0,
  cad_terceirizado_time NUMERIC DEFAULT 0,
  cad_terceirizado_cost NUMERIC DEFAULT 0,
  cad_ia_time NUMERIC DEFAULT 0,
  cad_ia_cost NUMERIC DEFAULT 0,
  cad_mentoria_cost NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roi_card_cad_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read roi_card_cad_types"
  ON roi_card_cad_types FOR SELECT USING (true);

CREATE POLICY "Admins can manage roi_card_cad_types"
  ON roi_card_cad_types FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Extend roi_cards with new columns
ALTER TABLE roi_cards
  ADD COLUMN IF NOT EXISTS resin_id UUID REFERENCES resins(id),
  ADD COLUMN IF NOT EXISTS printer_model_id UUID REFERENCES models(id),
  ADD COLUMN IF NOT EXISTS cam_support_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cam_support_time NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cam_operator TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS workflow_descriptions JSONB DEFAULT '{}';
