ALTER TABLE public.dealer_price_items
  ALTER COLUMN presentation_qty TYPE text
  USING presentation_qty::text;