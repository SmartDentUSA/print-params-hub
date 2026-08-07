CREATE TABLE public.seller_briefing_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  canal text NOT NULL DEFAULT 'whatsapp',
  sender_instance text NOT NULL DEFAULT 'smartdent_marketing',
  quando text NOT NULL DEFAULT 'lead_atribuido',
  delay_minutos integer NOT NULL DEFAULT 0,
  horario_inicio time NOT NULL DEFAULT '00:00',
  horario_fim time NOT NULL DEFAULT '23:59',
  usar_template_padrao boolean NOT NULL DEFAULT true,
  mensagem_template text,
  incluir_link_wa boolean NOT NULL DEFAULT true,
  link_wa_mensagem text NOT NULL DEFAULT 'Olá {{primeiro_nome}}, tudo bem? Sou da Smart Dent e recebi seu contato sobre {{produto_interesse}}.',
  purge_enabled boolean NOT NULL DEFAULT false,
  purge_hora integer NOT NULL DEFAULT 6,
  purge_idade_horas integer NOT NULL DEFAULT 24,
  purge_last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_briefing_config_canal_chk CHECK (canal IN ('whatsapp','email','sms')),
  CONSTRAINT seller_briefing_config_quando_chk CHECK (quando IN ('lead_atribuido','lead_criado')),
  CONSTRAINT seller_briefing_config_purge_hora_chk CHECK (purge_hora IN (6,23)),
  CONSTRAINT seller_briefing_config_singleton_chk CHECK (singleton)
);

CREATE UNIQUE INDEX seller_briefing_config_singleton_uq ON public.seller_briefing_config (singleton);

GRANT SELECT, INSERT, UPDATE ON public.seller_briefing_config TO authenticated;
GRANT ALL ON public.seller_briefing_config TO service_role;

ALTER TABLE public.seller_briefing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read briefing config"
ON public.seller_briefing_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create briefing config"
ON public.seller_briefing_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update briefing config"
ON public.seller_briefing_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_seller_briefing_config_updated_at
BEFORE UPDATE ON public.seller_briefing_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.seller_briefing_config (ativo, canal, sender_instance, quando, usar_template_padrao)
VALUES (true, 'whatsapp', 'smartdent_marketing', 'lead_atribuido', true);

ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS purged_at timestamptz;