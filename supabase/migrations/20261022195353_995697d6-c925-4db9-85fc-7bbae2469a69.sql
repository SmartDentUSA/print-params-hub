
-- 1) Novo tipo de formulário: distribuicao
ALTER TABLE public.smartops_forms DROP CONSTRAINT smartops_forms_form_purpose_check;
ALTER TABLE public.smartops_forms ADD CONSTRAINT smartops_forms_form_purpose_check CHECK (form_purpose = ANY (ARRAY['nps','sdr','roi','cs','captacao','evento','sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals','feira_evento','credenciamento','distribuicao']));

-- 2) Nova função de team member: distribuicao
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_check CHECK (role = ANY (ARRAY['vendedor','cs','suporte','marketing','lia_comms','distribuicao']));

INSERT INTO public.team_members (role, nome_completo, email, whatsapp_number, piperun_owner_id, ativo, messaging_provider)
SELECT 'distribuicao', 'Fábio Rinaldi', 'fabio.rinaldi@smartdent.com.br', '5516996359553', '103060', true, 'none'
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE lower(email) = 'fabio.rinaldi@smartdent.com.br');

-- 3) Formulário padrão (modelo)
DO $$
DECLARE v_tpl uuid;
BEGIN
  SELECT id INTO v_tpl FROM public.smartops_forms WHERE slug = 'distribuicao-cadastro';
  IF v_tpl IS NULL THEN
    INSERT INTO public.smartops_forms (name, slug, title, subtitle, form_purpose, active, display_mode, success_message, forced_seller_team_member_id)
    VALUES ('# - Distribuição - Cadastro', 'distribuicao-cadastro', 'Cadastro de Distribuidor',
            'Quer distribuir Smart Dent na sua região? Preencha os dados da sua empresa.',
            'distribuicao', true, 'list', 'Recebemos seu cadastro! Nossa equipe de distribuição entrará em contato.',
            (SELECT id FROM public.team_members WHERE lower(email)='fabio.rinaldi@smartdent.com.br' LIMIT 1))
    RETURNING id INTO v_tpl;

    INSERT INTO public.smartops_form_fields (form_id, label, field_type, db_column, custom_field_name, required, order_index, placeholder) VALUES
    (v_tpl,'Razão Social','text','empresa_razao_social',NULL,true,1,NULL),
    (v_tpl,'Nome Fantasia','text','empresa_nome',NULL,false,2,NULL),
    (v_tpl,'País','text','empresa_pais',NULL,false,3,NULL),
    (v_tpl,'Estado / Província','text','empresa_uf',NULL,false,4,NULL),
    (v_tpl,'Cidade','text','empresa_cidade',NULL,false,5,NULL),
    (v_tpl,'Endereço Completo','text','empresa_endereco',NULL,false,6,NULL),
    (v_tpl,'CEP / Código Postal','text',NULL,'distribuidor_cep',false,7,NULL),
    (v_tpl,'Número de Unidades / Filiais','text',NULL,'distribuidor_unidades',false,8,NULL),
    (v_tpl,'Site Oficial (URL)','text','empresa_website',NULL,false,9,'https://'),
    (v_tpl,'Instagram','text',NULL,'distribuidor_instagram',false,10,'@'),
    (v_tpl,'Facebook','text','empresa_facebook',NULL,false,11,NULL),
    (v_tpl,'LinkedIn da empresa','text','empresa_linkedin',NULL,false,12,NULL),
    (v_tpl,'Canal YouTube','text',NULL,'distribuidor_youtube',false,13,NULL),
    (v_tpl,'Nome do Proprietário / Diretor','text','nome',NULL,true,14,NULL),
    (v_tpl,'E-mail do Proprietário / Diretor','email','email',NULL,true,15,NULL),
    (v_tpl,'WhatsApp do Proprietário / Diretor','phone','telefone_raw',NULL,true,16,NULL),
    (v_tpl,'Responsável de Compras — Nome','text',NULL,'distribuidor_compras_nome',false,17,NULL),
    (v_tpl,'Responsável de Compras — E-mail','text',NULL,'distribuidor_compras_email',false,18,NULL),
    (v_tpl,'Responsável de Compras — WhatsApp','text',NULL,'distribuidor_compras_whatsapp',false,19,NULL),
    (v_tpl,'Regiões / cidades atendidas','text',NULL,'distribuidor_regioes',false,20,'Separadas por vírgula'),
    (v_tpl,'Linhas Smart Dent de interesse','text',NULL,'distribuidor_linhas',false,21,'Separadas por vírgula'),
    (v_tpl,'Idioma preferencial','select',NULL,'distribuidor_idioma',false,22,NULL),
    (v_tpl,'Moeda preferida','select',NULL,'distribuidor_moeda',false,23,NULL),
    (v_tpl,'Observações','text',NULL,'distribuidor_observacoes',false,24,NULL);
    UPDATE public.smartops_form_fields SET options='["Português","English","Español"]'::jsonb WHERE form_id=v_tpl AND custom_field_name='distribuidor_idioma';
    UPDATE public.smartops_form_fields SET options='["BRL","USD","EUR"]'::jsonb WHERE form_id=v_tpl AND custom_field_name='distribuidor_moeda';
  END IF;
END $$;

-- 4) Clonagem do modelo para um evento (idempotente)
CREATE OR REPLACE FUNCTION public.fn_clone_distribuicao_form_for_event(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tpl public.smartops_forms; v_ev public.smartops_events; v_new uuid; v_slug text;
BEGIN
  SELECT * INTO v_ev FROM smartops_events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO v_new FROM smartops_forms WHERE event_id = p_event_id AND form_purpose = 'distribuicao' LIMIT 1;
  IF v_new IS NOT NULL THEN RETURN v_new; END IF;
  SELECT * INTO v_tpl FROM smartops_forms WHERE slug = 'distribuicao-cadastro';
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_slug := 'distribuicao-' || coalesce(nullif(v_ev.slug,''), left(p_event_id::text, 8));
  IF EXISTS (SELECT 1 FROM smartops_forms WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || left(p_event_id::text, 6);
  END IF;
  INSERT INTO smartops_forms (name, slug, title, subtitle, form_purpose, active, display_mode, success_message, forced_seller_team_member_id, event_id, theme_color)
  VALUES ('# - Distribuição - Cadastro - ' || v_ev.name, v_slug, v_tpl.title, v_tpl.subtitle, 'distribuicao', true,
          v_tpl.display_mode, v_tpl.success_message, v_tpl.forced_seller_team_member_id, p_event_id, v_tpl.theme_color)
  RETURNING id INTO v_new;
  INSERT INTO smartops_form_fields (form_id, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, help_text)
  SELECT v_new, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, help_text
  FROM smartops_form_fields WHERE form_id = v_tpl.id;
  RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.fn_clone_distribuicao_form_for_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clone_distribuicao_form_for_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_event_clone_distribuicao_form()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fn_clone_distribuicao_form_for_event(NEW.id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_event_clone_distribuicao_form() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_event_clone_distribuicao_form ON public.smartops_events;
CREATE TRIGGER trg_event_clone_distribuicao_form AFTER INSERT ON public.smartops_events
FOR EACH ROW EXECUTE FUNCTION public.trg_event_clone_distribuicao_form();

-- 5) Backfill para eventos existentes
SELECT public.fn_clone_distribuicao_form_for_event(id) FROM public.smartops_events;
