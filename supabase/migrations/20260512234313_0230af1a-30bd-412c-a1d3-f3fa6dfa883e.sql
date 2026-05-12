
CREATE TABLE IF NOT EXISTS public.lia_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  subtitulo text,
  icone text NOT NULL DEFAULT 'message-square',
  cor text NOT NULL DEFAULT 'blue',
  trigger_event text,
  trigger_tags text[] NOT NULL DEFAULT '{}',
  canal text NOT NULL DEFAULT 'whatsapp',
  horario_inicio time DEFAULT '08:00',
  horario_fim time DEFAULT '18:00',
  mensagem_horario_comercial text,
  mensagem_fora_horario text,
  ativo boolean NOT NULL DEFAULT true,
  function_name text,
  short_link_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lia_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lia_automations"
ON public.lia_automations
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read lia_automations"
ON public.lia_automations
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE TRIGGER update_lia_automations_updated_at
BEFORE UPDATE ON public.lia_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lia_automations (slug, nome, subtitulo, icone, cor, trigger_event, trigger_tags, function_name, short_link_tag, mensagem_horario_comercial, mensagem_fora_horario)
VALUES
('boas_vindas_lead', 'Boas-vindas ao Lead', 'Mensagem inicial enviada ao lead após captura', 'message-square-dot', 'blue',
 'lead_captured', ARRAY['Lead capturado','Pré-atribuição'], 'lia-welcome-lead', 'welcome',
 'Olá {nome}! 👋 Sou a LIA, assistente da Smart Dent. Vi seu interesse em {produto}. Em instantes um especialista vai te chamar.',
 'Olá {nome}! 👋 Recebemos seu contato sobre {produto}. Nossa equipe entra em contato no próximo horário comercial (08h–18h).'),
('briefing_vendedor', 'Briefing ao Vendedor', 'Resumo do lead enviado ao vendedor atribuído', 'file-text', 'green',
 'lead_assigned_to_seller', ARRAY['Lead atribuído a vendedor'], 'lia-briefing-seller', 'briefing',
 'Olá {vendedor}! Novo lead atribuído: *{nome}* — interesse: {produto} ({especialidade}/{cidade}). Pipe: {piperun_id}.',
 'Olá {vendedor}! Lead recebido fora do horário: *{nome}* — {produto}. Atender no próximo expediente.')
ON CONFLICT (slug) DO NOTHING;
