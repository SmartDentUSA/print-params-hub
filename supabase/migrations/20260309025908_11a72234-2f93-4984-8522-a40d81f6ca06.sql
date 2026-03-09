CREATE TABLE resin_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resin_id UUID NOT NULL REFERENCES resins(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  price NUMERIC DEFAULT 0,
  price_per_gram NUMERIC DEFAULT 0,
  print_type TEXT DEFAULT '',
  grams_per_print NUMERIC DEFAULT 0,
  prints_per_bottle INTEGER DEFAULT 0,
  cost_per_print NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE resin_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read resin_presentations"
  ON resin_presentations FOR SELECT USING (true);

CREATE POLICY "Admins can manage resin_presentations"
  ON resin_presentations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));