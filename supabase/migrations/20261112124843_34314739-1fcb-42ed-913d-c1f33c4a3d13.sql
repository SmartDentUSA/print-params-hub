ALTER TABLE public.promotional_tables ADD COLUMN IF NOT EXISTS drive_folder_id text, ADD COLUMN IF NOT EXISTS drive_folder_url text;
CREATE TABLE public.promotional_table_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotional_table_id uuid NOT NULL REFERENCES public.promotional_tables(id) ON DELETE CASCADE,
  drive_file_id text,
  drive_url text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  storage_url text,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotional_table_creatives TO authenticated;
GRANT ALL ON public.promotional_table_creatives TO service_role;
ALTER TABLE public.promotional_table_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promo creatives" ON public.promotional_table_creatives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX ON public.promotional_table_creatives(promotional_table_id, sort_order);
CREATE TRIGGER trg_promo_creatives_updated BEFORE UPDATE ON public.promotional_table_creatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();