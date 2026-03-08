

# Expandir Dialog de Detalhes do Lead — Todos os Campos

## Problema
O dialog de detalhes do lead mostra apenas ~18 campos. A tabela `lia_attendances` tem ~200 colunas. O usuário quer ver **todos** os campos disponíveis ao clicar num lead.

## Abordagem
Reorganizar o dialog em **seções colapsáveis** (Accordion) agrupando os campos por categoria. Buscar `select("*")` para garantir que todos os campos estão disponíveis (já faz isso). Remover o `LeadRow` tipado restritivo e usar `[key: string]: unknown` que já existe.

## Seções do Dialog

1. **Identificação** — nome, email, telefone, cidade, uf, area_atuacao, especialidade, pais_origem
2. **Funil & Status** — lead_status, status_oportunidade, temperatura_lead, lead_stage_detected, urgency_level, status_atual_lead_crm, funil_entrada_crm, ultima_etapa_comercial
3. **Oportunidade CRM** — valor_oportunidade, piperun_id, piperun_link, piperun_title, piperun_pipeline_name, piperun_stage_name, piperun_origin_name, piperun_description, piperun_observation, piperun_probability, piperun_lead_time, piperun_value_mrr, piperun_status, piperun_frozen, piperun_created_at, piperun_closed_at, piperun_last_contact_at, piperun_stage_changed_at
4. **Pessoa & Empresa** — pessoa_cpf, pessoa_cargo, pessoa_genero, pessoa_linkedin, pessoa_facebook, pessoa_nascimento, empresa_cnpj, empresa_razao_social, empresa_nome, empresa_porte, empresa_segmento, empresa_website, empresa_cnae
5. **Produtos Ativos** — badges ativo_X + datas de ativação + equipamentos + seriais
6. **Produtos de Interesse (SDR)** — todos os sdr_* fields + params (marca, modelo, resina)
7. **Proposta** — itens_proposta_crm, itens_proposta_parsed, proposals_data, proposals_total_value, proposals_total_mrr, proposals_last_status
8. **Inteligência & Cognitivo** — intelligence_score (JSON), intelligence_score_total, cognitive_analysis (JSON), lead_stage_detected, psychological_profile, primary_motivation, objection_risk, recommended_approach, interest_timeline, confidence_score_analysis
9. **Histórico LIA** — total_sessions, total_messages, ultima_sessao_at, rota_inicial_lia, resumo_historico_ia, historico_resumos (JSON)
10. **Astron** — astron_status, astron_user_id, astron_nome, astron_email, astron_plans_active, astron_courses_total, astron_courses_completed, astron_last_login_at
11. **Loja Integrada** — lojaintegrada_cliente_id, lojaintegrada_ltv, lojaintegrada_total_pedidos_pagos, lojaintegrada_ultimo_pedido_*, lojaintegrada_forma_pagamento, etc.
12. **UTM & Origem** — source, form_name, utm_source, utm_medium, utm_campaign, utm_term, ip_origem, origem_campanha
13. **CS & Suporte** — cs_treinamento, sdr_suporte_equipamento, sdr_suporte_tipo, sdr_suporte_descricao, codigo_contrato, data_treinamento, data_contrato
14. **Tags & Metadados** — tags_crm, motivo_perda, comentario_perda, id_cliente_smart, created_at, updated_at, entrada_sistema
15. **Raw Data** — raw_payload, sellflux_custom_fields, piperun_custom_fields, empresa_custom_fields (JSON viewers)

## Alterações

**Ficheiro**: `src/components/SmartOpsAudienceBuilder.tsx`

- Substituir o bloco do Dialog (linhas 773-884) por versão expandida usando `Accordion` com todas as seções
- Cada seção usa um helper `FieldGrid` que renderiza pares label/value, filtrando nulls
- Campos JSON (cognitive_analysis, intelligence_score, proposals_data, raw_payload, etc.) renderizados com `<pre>` formatado
- Campos booleanos mostram ✓/✗
- Campos de data formatados com `formatDate`
- Dialog expandido para `max-w-4xl`
- Accordion já importado no componente (Collapsible), trocar por Accordion para melhor UX com múltiplas seções

