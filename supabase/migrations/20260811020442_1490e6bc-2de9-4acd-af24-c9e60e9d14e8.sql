ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS wa_welcome_link_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.team_members.wa_welcome_link_enabled IS
  'Se false, o número deste vendedor NUNCA é usado no link wa.me da mensagem de boas-vindas (número quebrado/inexistente no WhatsApp).';