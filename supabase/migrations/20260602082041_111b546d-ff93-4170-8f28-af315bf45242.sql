CREATE TABLE IF NOT EXISTS public.social_zernio_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zernio_account_id text UNIQUE NOT NULL,
  zernio_profile_id text NOT NULL,
  platform text NOT NULL,
  handle text,
  display_name text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  raw jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_zernio_accounts TO authenticated;
GRANT ALL ON public.social_zernio_accounts TO service_role;

ALTER TABLE public.social_zernio_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read social_zernio_accounts"
  ON public.social_zernio_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_social_zernio_accounts_platform_active
  ON public.social_zernio_accounts(platform) WHERE active;