UPDATE public.trigger_automations
SET action_config = jsonb_build_object(
      'assunto', '',
      'link_url', '',
      'destinatario', 'interno',
      'notify_team_member_id', '172d39ee-7eb0-403e-a36e-d1750e14b8bf',
      'team_member_id', '172d39ee-7eb0-403e-a36e-d1750e14b8bf',
      'mensagem', 'Time, o cliente {{nome}} chamou no WhatsApp: "{{mensagem_cliente}}". Entrar em contato: {{link_cliente}}',
      'client_link_message', 'Olá, aqui é do suporte técnico da Smart Dent, utilize este número para falar com a gente. Em que posso te ajudar?'
    ),
    updated_at = now()
WHERE id = '459d2989-39ca-4717-867b-64c2fb20ac55';