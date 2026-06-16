
-- Tokens OAuth Google
CREATE TABLE public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scopes text[],
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_oauth_tokens TO authenticated;
GRANT ALL ON public.google_oauth_tokens TO service_role;

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_oauth_tokens" ON public.google_oauth_tokens
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_google_oauth_tokens_updated
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reviews
CREATE TABLE public.google_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id text UNIQUE NOT NULL,
  account_id text,
  location_id text,
  reviewer_name text,
  reviewer_photo_url text,
  star_rating integer CHECK (star_rating BETWEEN 1 AND 5),
  comment text,
  create_time timestamptz,
  update_time timestamptz,
  reply_text text,
  reply_time timestamptz,
  ai_response_draft text,
  response_status text NOT NULL DEFAULT 'pending'
    CHECK (response_status IN ('pending','published','skipped','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_reviews TO authenticated;
GRANT ALL ON public.google_reviews TO service_role;

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_google_reviews" ON public.google_reviews
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_google_reviews_create_time ON public.google_reviews (create_time DESC);
CREATE INDEX idx_google_reviews_status ON public.google_reviews (response_status);

CREATE TRIGGER trg_google_reviews_updated
  BEFORE UPDATE ON public.google_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
