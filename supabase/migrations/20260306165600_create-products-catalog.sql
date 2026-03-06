-- Migration: create products_catalog table
-- Destination table for Sistema A product sync (sync-sistema-a Edge Function)
--
-- pg_cron schedule (run in Supabase SQL Editor or via pg_cron extension):
--   SELECT cron.schedule(
--     'sync-sistema-a-every-4h',
--     '0 */4 * * *',
--     $$
--       SELECT net.http_post(
--         url := current_setting('app.supabase_url') || '/functions/v1/sync-sistema-a',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--           'Content-Type', 'application/json'
--         ),
--         body := '{}'::jsonb
--       );
--     $$
--   );

CREATE TABLE IF NOT EXISTS public.products_catalog (
  product_id              text        PRIMARY KEY,
  name                    text,
  category                text,
  subcategory             text,
  workflow_stages         jsonb,
  whatsapp_sequences      jsonb,
  whatsapp_messages       jsonb,
  forbidden_products      jsonb,
  required_products       jsonb,
  anti_hallucination_rules jsonb,
  clinical_brain_status   text,
  synced_at               timestamptz
);

COMMENT ON TABLE public.products_catalog IS 'Product catalog synced from Sistema A (Smart Dent CIP) via sync-sistema-a Edge Function';
