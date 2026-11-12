ALTER TABLE public.promotional_tables ADD COLUMN IF NOT EXISTS social_hashtags text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.promotional_social_post_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotional_table_id uuid NOT NULL REFERENCES public.promotional_tables(id) ON DELETE CASCADE,
  social_post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  whatsapp_message text NOT NULL DEFAULT '',
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotional_table_id, social_post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotional_social_post_messages TO authenticated;
GRANT ALL ON public.promotional_social_post_messages TO service_role;
ALTER TABLE public.promotional_social_post_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promo social messages" ON public.promotional_social_post_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promo_social_msgs_updated BEFORE UPDATE ON public.promotional_social_post_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.promotional_social_seller_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotional_table_id uuid NOT NULL REFERENCES public.promotional_tables(id) ON DELETE CASCADE,
  social_post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotional_table_id, social_post_id, team_member_id)
);
GRANT SELECT ON public.promotional_social_seller_messages TO authenticated;
GRANT ALL ON public.promotional_social_seller_messages TO service_role;
ALTER TABLE public.promotional_social_seller_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read seller social messages" ON public.promotional_social_seller_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promo_social_seller_msgs_updated BEFORE UPDATE ON public.promotional_social_seller_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();