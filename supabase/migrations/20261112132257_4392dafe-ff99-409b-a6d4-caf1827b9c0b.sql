CREATE TABLE public.promotional_creative_seller_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid NOT NULL REFERENCES public.promotional_table_creatives(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creative_id, team_member_id)
);
GRANT ALL ON public.promotional_creative_seller_messages TO service_role;
ALTER TABLE public.promotional_creative_seller_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read seller creative messages" ON public.promotional_creative_seller_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.promotional_creative_seller_messages TO authenticated;
CREATE TRIGGER set_promotional_creative_seller_messages_updated_at
  BEFORE UPDATE ON public.promotional_creative_seller_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_promotional_updated_at();