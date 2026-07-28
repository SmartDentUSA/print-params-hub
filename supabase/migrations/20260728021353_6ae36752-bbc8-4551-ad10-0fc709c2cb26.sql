CREATE TABLE IF NOT EXISTS public._gate0_runtime_audit (
  slug text PRIMARY KEY,
  version int,
  verify_jwt boolean,
  status text,
  updated_at bigint,
  runtime_sha256 text,
  body_size int,
  fetch_status int,
  error text,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._gate0_runtime_audit TO service_role;
ALTER TABLE public._gate0_runtime_audit ENABLE ROW LEVEL SECURITY;