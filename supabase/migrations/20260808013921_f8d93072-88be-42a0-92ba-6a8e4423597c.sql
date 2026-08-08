CREATE TABLE IF NOT EXISTS public.wa_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  function_name text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  wa_instance_name text,
  message_template text,
  variaveis text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_automation_settings TO authenticated;
GRANT ALL ON public.wa_automation_settings TO service_role;

ALTER TABLE public.wa_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_automation_settings"
ON public.wa_automation_settings
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read wa_automation_settings"
ON public.wa_automation_settings
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE TRIGGER update_wa_automation_settings_updated_at
BEFORE UPDATE ON public.wa_automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.wa_automation_settings (slug, nome, descricao, function_name, wa_instance_name, message_template, variaveis)
VALUES
('stripe_payment_notice', 'Aviso de pagamento Stripe', 'Avisa vendedor e executivos quando um pagamento é confirmado no Stripe.', '_shared/stripe-notify', 'smartdent_marketing',
'{{titulo}}
{{subtitulo}}
-> {{produto_interno}} <-
Cliente: {{cliente}}
Email: {{email}}
Telefone: {{telefone}}
Valor pago: {{valor}}
Faturado às: {{hora}}
Produto Stripe: {{produto_stripe}}
Data de pagamento: {{data}}
Vendedor: {{vendedor}}',
ARRAY['{{titulo}}','{{subtitulo}}','{{produto_interno}}','{{cliente}}','{{email}}','{{telefone}}','{{valor}}','{{hora}}','{{produto_stripe}}','{{data}}','{{vendedor}}']),
('technical_ticket', 'Ticket técnico', 'Notifica o time de suporte quando um novo ticket técnico é aberto.', 'create-technical-ticket', 'Suporte_tecnico', NULL, ARRAY['{{ticket}}']),
('lia_escalation', 'Escalação da LIA para humano', 'Aciona o suporte/vendedor quando a Dra. LIA escala um atendimento.', '_shared/lia-escalation', 'Suporte_tecnico', NULL, ARRAY['{{lead}}']),
('sentinela_daily_report', 'Relatório diário Sentinela', 'Envia o resumo diário do Sentinela por WhatsApp.', 'sentinela-daily-report', 'smartdent_marketing', NULL, ARRAY['{{relatorio}}']),
('training_factory_publish', 'Publicação de treinamento', 'Avisa o time quando um material de treinamento é publicado.', 'training-factory-publish', 'smartdent_marketing', NULL, ARRAY['{{aviso}}'])
ON CONFLICT (slug) DO NOTHING;