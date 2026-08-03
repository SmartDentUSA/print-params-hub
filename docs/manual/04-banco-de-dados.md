# 04 — Banco de Dados

Projeto `okeogjgqijbfkudfjadz` · Postgres 15 · extensões relevantes: `pgcrypto`, `pg_cron`, `pg_net`, `pgvector`, `pg_trgm`, `unaccent`, `pg_stat_statements`.

## 4.1 Inventário

| Objeto | Qtde |
|---|---|
| Tabelas `public` | 265 (222 sem linhas ou com estatística zerada) |
| Views | 100 |
| Funções | 421 (161 `SECURITY DEFINER`, 256 sem `search_path` fixo) |
| Triggers | 147 |
| Índices | 1.062 |
| Foreign keys | 213 |
| Policies RLS | 435 |
| Schemas extra | `copilot_brain` (snapshots do agente interno) |

### Maiores tabelas por tamanho

| Tabela | Linhas | Tamanho |
|---|---|---|
| `system_health_logs` | 2.630.000 | 1,7 GB |
| `lia_attendances` | 33.900 | 1,0 GB |
| `lead_state_events` | ~350 k | 686 MB |
| `lead_enrichment_audit` | ~300 k | 530 MB |
| `deals` | 42.900 | ~300 MB |
| `agent_embeddings` | 10.500 | pgvector |
| `knowledge_contents` | 813 | 64 colunas |

`lia_attendances` tem **610 colunas** — é o maior fator de risco estrutural do banco (ver 4.7).

## 4.2 Domínios de dados

| Domínio | Tabelas centrais |
|---|---|
| **Identidade / CDP** | `lia_attendances` (canônico, `merged_into`), `identity_keys`, `lead_identity_merges`, `piperun_persons_mirror`, `piperun_companies_mirror` |
| **Comercial / CRM** | `deals`, `deal_items`, `deal_stage_history`, `lead_opportunities`, `piperun_*`, `painel_comercial_cache` |
| **Fiscal / ERP** | `omie_notas_fiscais`, `omie_nfse`, `omie_parcelas`, `omie_clientes`, `omie_snapshot_mensal` |
| **E-commerce** | `loja_integrada_orders`, `loja_integrada_order_items`, `loja_integrada_clients` |
| **Catálogo** | `system_a_catalog`, `catalog_product_variations`, `catalog_kit_components`, `produto_aliases`, `catalog_documents`, `brands`, `models`, `resins`, `parameter_sets` |
| **WhatsApp** | `wa_message_queue`, `whatsapp_send_queue`, `wa_send_log`, `whatsapp_inbox`, `wa_groups`, `wa_group_dispatch_log`, `team_members` |
| **Campanhas** | `campaigns`, `campaign_recipients`, `campaign_send_log`, `email_sequences`, `email_sequence_dispatches`, `campaign_sms_responses`, `short_links` |
| **Formulários / LP** | `smartops_forms`, `smartops_form_fields`, `smartops_form_field_responses`, `smartops_form_landing_pages`, `smartops_bio_pages`, `smart_form_rate_limit` |
| **Cursos / CS** | `smartops_courses`, `smartops_course_turmas`, `smartops_course_enrollments`, `cs_nps_responses`, `certificates` |
| **Conteúdo / SEO** | `knowledge_contents`, `knowledge_videos`, `authors`, `commercial_faqs`, `success_stories`, `smartdent_method_docs` |
| **IA / RAG** | `agent_embeddings`, `text_embedding_cache`, `image_embedding_cache`, `ai_token_usage`, `ai_model_routing`, `agent_knowledge_gaps`, schema `copilot_brain` |
| **Observabilidade** | `system_health_logs`, `edge_function_catalog`, `lead_state_events`, `lead_enrichment_audit`, `lead_activity_log` |
| **Pagamentos** | `stripe_subscriptions`, `stripe_webhook_events`, `stripe_payment_units`, `platform_subscriptions` |
| **Distribuição** | `distributors`, `dealers`, `dealer_price_lists`, `dealer_price_items`, `dealer_proposals` |
| **Inteligência** | `sentinela_group_messages`, `sentinela_insights`, `operational_flows`, `workflow_cell_mappings`, `roi_cards` |

DER textual e Mermaid no cap. 12.

## 4.3 Tabela-pivô `lia_attendances` (grupos de colunas)

| Grupo | Exemplos |
|---|---|
| Identidade | `nome`, `email`, `telefone`, `cpf`, `cnpj`, `pessoa_hash`, `merged_into`, `piperun_id`, `pessoa_piperun_id` |
| Qualificação | `area_atuacao`, `especialidade`, `produto_interesse`, `cargo`, `cidade`, `uf` |
| Origem | `origem`, `platform_lead_id`, `form_id`, `raw_payload`, `entrada_sistema`, `utm_*` |
| Workflow 7×3 | `hits_scanner`, `hits_cad`, `hits_impressao3d`, `hits_pos_impressao`, `hits_insumos_cursos`, `hits_finalizacao`, `hits_fresagem`, `workflow_timeline` |
| Parque instalado | `equip_*`, `tem_scanner`, `tem_impressora`, `impressora_modelo`, `software_cad`, `map_fresadora_*` |
| Comercial | `ltv_total`, `last_deal_date`, `anchor_product`, `recompra_*`, `next_upsell_*`, `intelligence_score_total` |
| CRM espelhado | `piperun_stage_name`, `piperun_deals_history`, `piperun_activities`, `piperun_raw_payload` |
| CS/NPS | `astron_*`, `imersao_*`, campos de NPS |
| Locks/estado | `crm_lock_until`, `cognitive_analyzed_at`, `workflow_timeline_updated_at` |

**Regra de leitura obrigatória**: toda consulta de lead deve filtrar `merged_into IS NULL`; registros com `merged_into` preenchido são "sombras" já fundidas.

## 4.4 Views mais relevantes

| View | Uso |
|---|---|
| `v_lead_timeline` | timeline unificada da ficha do lead (mean 256 ms — ver cap. 08) |
| `v_sku_mapping_inbox` | itens de proposta sem SKU (aba Mapeamento de SKU) |
| `v_funnel_*`, `v_bowtie_*` | agregações de funil |
| `v_email_queue_*` | fila de e-mail |
| `v_leads_sem_crm` | leads captados sem deal correspondente |

## 4.5 Triggers de negócio (amostra crítica dos 147)

| Trigger | Tabela | Efeito |
|---|---|---|
| `auto_dedup_by_phone` | `lia_attendances` | funde leads por telefone — **causa raiz de falsos vínculos** (cap. 06/07) |
| `fn_sync_normalized_from_lead` | `lia_attendances` | propaga campos normalizados |
| `trg_autoregister_product_taxonomy` | `lead_opportunities` | cria taxonomia de produto antes do FK (evita erro 23503) |
| `fn_ping_google_on_publish` | `knowledge_contents` | dispara indexação ao publicar |
| `set_updated_at` (múltiplas) | várias | timestamp de atualização |
| triggers de `deal_stage_history` | `deals` | registra mudança de etapa com data real do CRM |

## 4.6 Funções SQL por família

| Família | Exemplos |
|---|---|
| Claim de fila | `claim_pending_wa_messages`, `claim_email_sequence_dispatch`, `claim_scheduled_broadcasts`, `try_claim_seller_note_slot` |
| Relatórios | `fn_relatorio_mes_kpis`, `fn_mix_produtos_mes`, `fn_faturamento_mes`, `fn_form_metrics`, `fn_email_campaign_metrics`, `fn_email_queue_status` |
| Painel de TV | `painel_comercial_refresh` + 6 RPCs `SECURITY DEFINER` |
| Busca | `fn_search_deals_for_training` (fuzzy + doc + telefone), `match_agent_embeddings` |
| Origens | `list_lead_origins`, `list_unmapped_meta_forms` |
| Cursos | `fn_generate_recurrent_turmas` |
| Diagnóstico | `check_copilot_brain_drift`, `get_rag_stats`, `fn_rayshape_status` |
| Catálogo | `save_produto_alias` e resolvedores de SKU |

## 4.7 Riscos estruturais

| # | Risco | Evidência | Impacto |
|---|---|---|---|
| 1 | `lia_attendances` com 610 colunas e 1 GB | introspecção | qualquer `SELECT *` (padrão do PostgREST em vários pontos) lê ~30 kB/linha; updates parciais reescrevem tuplas grandes (bloat) |
| 2 | Sem retenção em `system_health_logs` (1,7 GB) | tamanho | custo de storage, backups longos, dashboards lentos |
| 3 | 222 tabelas vazias | `pg_stat_user_tables` | ruído de schema; dificulta onboarding e migração |
| 4 | 256 funções sem `search_path` fixo | linter | risco de *search_path hijacking* |
| 5 | 213 FKs para 265 tabelas | catálogo | integridade referencial parcial; várias relações são apenas por convenção (ex.: `deal_id` textual) |
| 6 | Duplicidade de filas WhatsApp (`wa_message_queue` × `whatsapp_send_queue`) | schema | ambiguidade de fonte de verdade |
| 7 | `merged_into` sem constraint de acyclicidade | 16 cadeias de merge detectadas | leads apontando para leads já fundidos |

## 4.8 Backup e recuperação

- Backups gerenciados pelo Supabase (PITR conforme plano) + job `daily-backup-drive` (03:00) que envia export para o Google Drive.
- **Lacuna**: não existe procedimento documentado de restauração testada nem *runbook* de rollback para operações em massa (Full Sync, import de parâmetros, merge de identidade). Recomendação em cap. 11.