
-- Mapeamentos: vincula campos/produtos/concorrentes às células do workflow 7x3
CREATE TABLE public.workflow_cell_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_stage text NOT NULL,
  workflow_cell text NOT NULL,
  mapping_type text NOT NULL,
  mapped_value text NOT NULL,
  mapped_label text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workflow_stage, workflow_cell, mapping_type, mapped_value)
);

-- Regras de oportunidade por item detectado
CREATE TABLE public.opportunity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_stage text NOT NULL,
  workflow_cell text NOT NULL,
  source_item text NOT NULL,
  action_type text NOT NULL,
  target_product_name text,
  useful_life_months int DEFAULT 12,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: leitura pública, escrita autenticada
ALTER TABLE public.workflow_cell_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read workflow_cell_mappings" ON public.workflow_cell_mappings FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage workflow_cell_mappings" ON public.workflow_cell_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read opportunity_rules" ON public.opportunity_rules FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage opportunity_rules" ON public.opportunity_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
