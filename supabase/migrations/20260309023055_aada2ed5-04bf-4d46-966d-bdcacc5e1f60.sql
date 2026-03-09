
CREATE TABLE roi_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'combo',
  image_url TEXT,
  scan_time_manual NUMERIC DEFAULT 15,
  scan_time_smart NUMERIC DEFAULT 5,
  cad_time_manual NUMERIC DEFAULT 20,
  cad_time_smart NUMERIC DEFAULT 4,
  cad_cost_manual NUMERIC DEFAULT 50,
  cad_cost_smart NUMERIC DEFAULT 8,
  print_time_manual NUMERIC DEFAULT 15,
  print_time_smart NUMERIC DEFAULT 0.5,
  clean_time_manual NUMERIC DEFAULT 10,
  clean_time_smart NUMERIC DEFAULT 0.67,
  cure_time_manual NUMERIC DEFAULT 15,
  cure_time_smart NUMERIC DEFAULT 5,
  finish_time_manual NUMERIC DEFAULT 30,
  finish_time_smart NUMERIC DEFAULT 9,
  waste_pct_manual NUMERIC DEFAULT 20,
  waste_pct_smart NUMERIC DEFAULT 0,
  asb_scan BOOLEAN DEFAULT true,
  asb_cad BOOLEAN DEFAULT false,
  asb_print BOOLEAN DEFAULT true,
  asb_clean BOOLEAN DEFAULT true,
  asb_cure BOOLEAN DEFAULT true,
  asb_finish BOOLEAN DEFAULT true,
  preco_mercado NUMERIC,
  preco_combo NUMERIC,
  rendimento_unidades INTEGER,
  investimento_inicial NUMERIC DEFAULT 77900,
  faturamento_kit NUMERIC DEFAULT 128524.82,
  status TEXT DEFAULT 'rascunho',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roi_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published roi_cards"
  ON roi_cards FOR SELECT
  USING (status = 'publicado' AND active = true);

CREATE POLICY "Admins can manage all roi_cards"
  ON roi_cards FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_roi_cards_updated_at
  BEFORE UPDATE ON roi_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
