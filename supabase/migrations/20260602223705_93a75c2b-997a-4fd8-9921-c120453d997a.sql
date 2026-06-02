UPDATE public.social_zernio_accounts
SET zernio_profile_id = COALESCE(
  NULLIF(zernio_profile_id::jsonb->>'_id', ''),
  NULLIF(zernio_profile_id::jsonb->>'id', ''),
  zernio_profile_id
)
WHERE zernio_profile_id LIKE '{%';

UPDATE public.social_zernio_accounts
SET zernio_account_id = COALESCE(
  NULLIF(zernio_account_id::jsonb->>'_id', ''),
  NULLIF(zernio_account_id::jsonb->>'id', ''),
  zernio_account_id
)
WHERE zernio_account_id LIKE '{%';