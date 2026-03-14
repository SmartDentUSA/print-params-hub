

# Auditoria Técnica Completa — Revenue Intelligence OS v4.0

## Objetivo
Gerar documento MD exhaustivo cobrindo: arquitetura de engenharia, UX/UI, SEO E-E-A-T, fluxos de atendimento, fluxos de leads, campos/tabelas/endpoints/integrações, qualidade HTML gerado.

## Documento a ser gerado

O documento será criado em `docs/AUDITORIA_TECNICA_COMPLETA_V4.md` com as seguintes seções:

---

### Estrutura do Documento (~2500 linhas)

**Parte 1 — Identidade e Stack**
- Nomenclatura (Sistema B / Revenue Intelligence OS / Smart Dent Digital Hub)
- Stack completo: React 18.3 + Vite + TS + Tailwind + shadcn/ui + TanStack Query 5.83 + TipTap 3.7.2
- Backend: Supabase Edge Functions (Deno), PostgreSQL + RLS, Auth, Storage, Realtime
- IA: Gemini 2.5 Flash (conteudo), DeepSeek v3 (cognitivo), GPT-4.1 Mini (comparacao)
- 9 integrações externas mapeadas

**Parte 2 — Arquitetura Dual (Diagramas ASCII)**
- Lead Lifecycle Management (5 entry points → CDP → Cognitive → Automation)
- Content Intelligence Platform (fontes → extração → orquestração → pós-processamento → publicação)
- Agente Dra. L.I.A. (RAG + 3 canais)

**Parte 3 — CDP Unificado (`lia_attendances`, ~200 colunas)**
- Detalhamento completo dos 9 domínios com todos os campos:
  - Core (~15): id, nome, email, telefone_raw, telefone_normalized, lead_status, source, form_name, entrada_sistema, score, reuniao_agendada
  - Qualificação SDR (~15): 9x sdr_*_interesse, 3x sdr_*_param, 3x sdr_suporte_*
  - PipeRun CRM (~40): piperun_id/title/status/pipeline/stage/owner, pessoa_*, empresa_*, proposals_data, piperun_deals_history
  - Cognitive AI (~15): cognitive_analysis, 10 eixos individuais, confidence_score
  - Intelligence Score (~5): intelligence_score (JSONB), intelligence_score_total, formula 4 eixos
  - Equipamentos (~20): 5x equip_* + serial + ativação, 8x ativo_*, 8x data_ultima_compra_*
  - E-commerce Loja Integrada (~25): lojaintegrada_cliente_id, ltv, historico_pedidos, endereco, etc.
  - Astron Academy (~12): astron_user_id, status, plans, courses_access/total/completed
  - Automação (~10): proactive_sent_at/count, crm_lock_until/source, automation_cooldown_until

**Parte 4 — Inventário Completo de Endpoints (90+ Edge Functions)**
- Tabela com: nome, linhas de código, JWT, modelo IA usado, tabelas lidas, tabelas escritas, status
- Agrupados em 6 categorias:
  1. Leads & CRM (30 funções)
  2. Content & Knowledge (28 funções)
  3. Sitemaps & Discovery (8 funções)
  4. Agente Dra. L.I.A. (7 funções)
  5. Sync & Misc (16 funções)
  6. Meta Ads (3 funções — pendente consolidação)

**Parte 5 — Fluxos de Leads (8 fluxos detalhados)**
- Fluxo 1: Formulário → Ingest → Smart Merge → CRM → Cognitive (5 etapas)
- Fluxo 2: Meta Ads Webhook → Graph API → Ingest (7 etapas)
- Fluxo 3: SellFlux Webhook → Field mapping → Ingest (8 etapas)
- Fluxo 4: E-commerce (Loja Integrada) → Polling/Webhook → LTV (3 triggers)
- Fluxo 5: PipeRun Webhook bidirecional (Inbound 7 etapas + Outbound)
- Fluxo 6: Stagnation Processor (6 etapas com DeepSeek)
- Fluxo 7: Proactive Outreach (4 tipos com regras de elegibilidade)
- Fluxo 8: WhatsApp Inbox → Intent Classification (6 primários + 15 secundários)
- Cada fluxo com: trigger, entrada, campos de entrada/saída, tabelas afetadas, secrets usados

**Parte 6 — Fluxos de Conteúdo (7 fluxos detalhados)**
- Fluxo 1: PDF → Extração (4 funções) → Orquestração → Pós-processamento (6 funções) → Publicação
- Fluxo 2: Vídeo → Transcrição → Artigo
- Fluxo 3: Google Drive KB → Embeddings
- Fluxo 4: Apostila → Resinas
- Fluxo 5: Knowledge Gaps → Drafts → Artigos
- Fluxo 6: Tradução Pipeline (PT → EN/ES)
- Fluxo 7: SEO Exposure Pipeline (SSR + Sitemaps + RSS)
- Input/Output detalhado do Orquestrador (OrchestrationRequest/Response TypeScript interfaces)

**Parte 7 — Fluxos de Atendimento (Dra. L.I.A., 4 fluxos)**
- Widget Web → RAG → Response (session management, topic re-ranking, SDR consultivo SPIN)
- WhatsApp → dra-lia-whatsapp → Adaptador (dedup, stale filter, format WhatsApp)
- Embed iframe → AgentEmbed
- Indexação (8 fontes vetoriais, pipeline de chunking)
- Fluxo de Suporte Técnico (5 estágios → create-technical-ticket)
- Coleta obrigatória (gate: email → nome → telefone → área → especialidade)

**Parte 8 — Integrações Externas (9 sistemas)**
Cada integração com:
- Protocolo (REST/Webhook/Polling)
- Secrets necessários
- Campos de entrada (o que chega)
- Campos de saída (o que escreve no CDP)
- Volume de informações (quantidade de campos por integração)

| Integração | Protocolo | Campos entrada | Campos escritos no CDP | Volume |
|---|---|---|---|---|
| PipeRun CRM | REST + Webhook | deal_id, stage, pipeline, owner, person, company, proposals | ~40 colunas (piperun_*, pessoa_*, empresa_*, proposals_*) | Alto |
| SellFlux | REST + Webhook | email, phone, tags, custom_fields, tracking, transaction | ~5 colunas (sellflux_custom_fields, tags_crm) + UTMs | Médio |
| WaLeads | REST | phone, message, senderName, media | whatsapp_inbox table + seller notifications | Médio |
| Astron Members | Postback + REST | user_id, plans, courses, progress, login_url | ~12 colunas (astron_*) | Médio |
| Loja Integrada | Webhook + Polling | order, client, items, address, payment, tracking | ~25 colunas (lojaintegrada_*) | Alto |
| PandaVideo | REST | videos, analytics, tags, folders | knowledge_videos (~50 cols) | Alto |
| Google Drive | REST | documents text content | company_kb_texts (9 cols) | Baixo |
| Google Reviews | REST | reviews, ratings, place_id | system_a_catalog.extra_data.reviews_reputation | Baixo |
| Meta Ads | Webhook | leadgen_id, page_id, form_id, field_data | ~6 colunas (meta_*) + forward to ingest | Baixo |

**Parte 9 — Qualidade Técnica do HTML Gerado**
- Estrutura semântica: h2 → h3 → h4, parágrafos, tabelas com thead/tbody, listas, links
- Classes CSS customizadas: .content-card, .benefit-card, .cta-panel, .article-summary
- 6 regras anti-alucinação (ANTI_HALLUCINATION_RULES)
- Validação pós-processamento (negative lookbehind URLs, strip code fences)
- Entity annotations (data-entity-id)
- AI Citation Box (bloco logo após H1)
- GEO-Context automático

**Parte 10 — SEO E-E-A-T Compliance (17+ elementos)**
- `<title>` dinâmico < 60 chars
- `<meta description>` < 160 chars
- hreflang PT/EN/ES + x-default
- Canonical URLs com i18n
- Open Graph + Twitter Cards
- 7 tipos JSON-LD: Article (MedicalWebPage/TechArticle), Organization, Product+Offer, VideoObject, FAQPage (auto-extração), HowTo (4 métodos), BreadcrumbList
- `<meta ai-context>` para LLMs
- Author E-E-A-T completo (CRO, especialidade, Lattes/CNPq)
- llms.txt + robots.txt com Allow para GPTBot/ClaudeBot/PerplexityBot
- 5 Sitemaps XML (principal, KB-PT, KB-EN, KB-ES, docs)
- RSS/Atom feed
- SSR via seo-proxy (2004 linhas) com detecção de 15+ User-Agents de bots

**Parte 11 — UX/UI Architecture**
- Rotas públicas (15 rotas)
- Admin Panel (10 tabs principais)
- SmartOps (15 sub-tabs: Bowtie, Kanban/AudienceBuilder, Leads, Equipe, Automações, Logs, Relatórios, Conteúdo, Saúde, WhatsApp, Formulários, Tokens IA, Intelligence, SmartFlow, Copilot)
- Componentes SEO (11 componentes)
- Widget DraLIA global
- Design system: Tailwind tokens semânticos + shadcn/ui

**Parte 12 — Banco de Dados (30+ tabelas)**
- Todas as tabelas com: colunas, RLS, quem escreve, quem lê
- 5 Views de domínio
- RPCs: is_admin, is_author, has_panel_access, calculate_intelligence_score, match_agent_embeddings, match_agent_embeddings_v2, fn_calc_workflow_score, fn_recalc_ltv_from_deals, fn_map_lead_source, fn_get_lead_context, fn_record_lead_event, search_knowledge_base
- Triggers: trigger_evaluate_interaction, fn_normalize_phone, fn_trigger_workflow_score, update_knowledge_videos_search_vector, validate_support_case_status

**Parte 13 — Shared Modules (_shared/)**
- 15 módulos: system-prompt, testimonial-prompt, document-prompts, extraction-rules, log-ai-usage, piperun-field-map, sellflux-field-map, og-visual-dictionary, entity-dictionary, citation-builder, lia-guards, lia-lead-extraction, rate-limiter, resilient-fetch, waleads-messaging, generate-embedding, piperun-hierarchy

**Parte 14 — Secrets & Segurança**
- 15+ secrets necessários
- JWT config (4 com verify_jwt=true, 86+ com false)
- RLS patterns (admin_only, public_read+admin_CUD, service_insert+admin_read)

**Parte 15 — Métricas do Sistema**
| Métrica | Valor |
|---|---|
| Tabelas PostgreSQL | 30+ |
| Views | 5 |
| Edge Functions (config.toml) | 90 |
| Componentes React | 120+ |
| Shared Modules | 15 |
| Linhas código Edge Functions | ~60,000 |
| Colunas no CDP | ~200 |
| Idiomas | 3 (PT/EN/ES) |
| Entry points leads | 5 |
| Eixos cognitivos | 10 |
| Sitemaps | 5 |
| JSON-LD schemas | 17+ |
| Integrações externas | 9 |
| Sub-tabs SmartOps | 15 |
| Fontes RAG | 8 |

**Parte 16 — Findings e Recomendações**
- Tabela products_catalog órfã
- Meta Ads functions (3 separadas) precisam consolidação em gateway (limite de funções)
- dra-lia com 5092 linhas (candidata a refatoração)
- Person-centric model (Sprint 1 em andamento: people, companies, person_company_relationship)
- Copilot Dual Brain implementado
- Rate limit patterns necessários em mais funções

---

### Implementacao

Criar arquivo `docs/AUDITORIA_TECNICA_COMPLETA_V4.md` com todo o conteudo acima formatado em Markdown, incorporando dados atualizados do codebase atual (90 funções no config.toml, 15 sub-tabs SmartOps, Copilot, ROI Calculators, Support Cases, Person-centric model).

