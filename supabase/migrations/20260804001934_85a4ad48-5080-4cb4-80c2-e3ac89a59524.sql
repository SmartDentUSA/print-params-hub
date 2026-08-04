ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS email_secundarios text[],
  ADD COLUMN IF NOT EXISTS email_invalido_raw text;

COMMENT ON COLUMN public.lia_attendances.email_secundarios IS 'E-mails adicionais preservados quando a origem envia lista separada por virgula/ponto-e-virgula';
COMMENT ON COLUMN public.lia_attendances.email_invalido_raw IS 'Valor original preservado quando o e-mail recebido era invalido/placeholder';

CREATE INDEX IF NOT EXISTS idx_lia_attendances_email_secundarios
  ON public.lia_attendances USING gin (email_secundarios);