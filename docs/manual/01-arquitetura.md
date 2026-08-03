# 01 — Arquitetura e Visão Geral

## 1.1 Resumo executivo

O **SmartDent Revenue Intelligence OS** é a plataforma interna de receita da Smart Dent (distribuidora de equipamentos e insumos de odontologia digital). Ele acumula quatro papéis que normalmente seriam quatro produtos:

1. **CDP / CRM operacional** — captura leads de Meta Ads, formulários, e-commerce e WhatsApp, resolve identidade, cria e sincroniza oportunidades no PipeRun (CRM externo, fonte de verdade comercial) e no Omie (ERP, fonte de verdade fiscal).
2. **Automação de relacionamento** — WhatsApp (Evolution API e EvolutionGO), e-mail (Gmail), SMS (Disparo Pro), sequências, reativação, NPS pós-treinamento, publicação em redes sociais (Zernio).
3. **Camada de IA** — agente público "Dra. LIA" (SDR/consultora com RAG), "Copilot" interno (gerente comercial sênior), watchdogs, geração de conteúdo e enriquecimento de dados.
4. **Site público + base de conhecimento SEO/GEO** — catálogo de parâmetros de impressão 3D, artigos, vídeos, distribuidores, landing pages e formulários públicos, com SSR dedicado para bots e LLMs.

Escala real medida em produção (2026-08-03):

| Dimensão | Valor |
|---|---|
| Tabelas `public` | 265 |
| Views | 100 |
| Funções SQL | 421 (161 `SECURITY DEFINER`) |
| Triggers | 147 |
| Índices | 1.062 |
| Foreign keys | 213 |
| Policies RLS | 435 (260 tabelas com RLS, 5 sem) |
| Edge Functions | 238 diretórios (~185 registradas em `config.toml`) |
| Jobs `pg_cron` | 91 (83 ativos) |
| Rotas React | 65 |
| Hooks | 60 (41 na raiz + 19 em subpastas) |
| Dependências npm | 81 |

Volumetria dominante: `system_health_logs` 2,6 M linhas / 1,7 GB · `lia_attendances` 33,9 k / 1,0 GB · `deals` 42,9 k · `lead_state_events` 686 MB · `lead_enrichment_audit` 530 MB.

## 1.2 Stack

| Camada | Tecnologia | Evidência |
|---|---|---|
| Frontend | React 18 + Vite 5 + TypeScript, React Router, TanStack Query, Tailwind + shadcn/ui, Recharts, ReactFlow/@xyflow, TipTap, dnd-kit | `package.json` |
| Geração de arquivos no cliente | `xlsx`, `exceljs`, `jspdf`(+autotable), `docx`, `jszip`, `file-saver`, `html-to-image` | `package.json` |
| Backend | Supabase Edge Functions (Deno), Postgres 15 + RLS, Storage, `pg_cron` + `pg_net`, `pgvector` | `supabase/functions/*`, `cron.job` |
| Hospedagem frontend | Vercel (rewrites + funções `api/*.ts`, uma delas com Chromium/Puppeteer) | `vercel.json`, `api/render-template.ts` |
| IA | Lovable AI Gateway, DeepSeek, Gemini, Anthropic, OpenRouter, POE; embeddings em `pgvector` | secrets + `_shared/ai-router.ts` |
| Observabilidade | `system_health_logs` + watchdogs em cron + painéis internos | cap. 08 |

## 1.3 Topologia

```text
                      ┌───────────────────────────────────────────┐
  Visitante/bot ─────► │ Vercel (SPA + rewrites + api/*.ts)        │
                      │  · bot UA → /api/seo-proxy → EF seo-proxy  │
                      │  · /api/v1/* → EF smart-dent-api           │
                      │  · s.smartdent.com.br → EF short-link-*    │
                      └──────────────┬────────────────────────────┘
                                     │ anon key (JWT em localStorage)
  Operador ──► /admin (SPA) ─────────┤
                                     ▼
                      ┌───────────────────────────────────────────┐
   Meta / PipeRun ───►│ Supabase Edge Functions (Deno, 238)       │◄─── pg_cron (83 jobs)
   Zernio / Stripe ──►│  webhooks · workers · APIs · agentes IA   │
   Evolution / Omie ─►└──────────────┬────────────────────────────┘
                                     ▼
                      ┌───────────────────────────────────────────┐
                      │ Postgres (265 tabelas, RLS, 421 funções,  │
                      │ 147 triggers, pgvector, filas em tabela)  │
                      └───────────────────────────────────────────┘
                                     ▲
   PipeRun · Omie · Loja Integrada · Stripe · Gmail · Disparo Pro ·
   Evolution/EvolutionGO · Zernio · Google (Drive/GSC/Places) · tl;dv · PandaVideo
```

## 1.4 Padrões arquiteturais em uso

| Padrão | Como aparece | Onde |
|---|---|---|
| Fila em tabela + worker em cron | `wa_message_queue`, `whatsapp_send_queue`, `email_sequence_dispatches`, `meta_lead_event_buffer`, `enrichment_safety_queue` | crons `wa-dispatcher`, `smartops-email-tick`, `social-publish-worker` |
| Claim atômico via RPC | `claim_pending_wa_messages`, `claim_email_sequence_dispatch`, `claim_scheduled_broadcasts`, `try_claim_seller_note_slot` | funções SQL |
| Lock com TTL em tabela | `cognitive_lead_locks`, `smartops_deal_note_locks`, `briefing_locks`, `boas_vindas_locks`, `crm_lock_until` | cap. 06 |
| Espelho local de sistema externo | `piperun_persons_mirror`, `piperun_companies_mirror`, `deals`, `omie_notas_fiscais`, `loja_integrada_orders`, `system_a_catalog` | cap. 05 |
| Cache materializado por cron | `painel_comercial_cache` (15 min), `omie_snapshot_mensal`, `text_embedding_cache`, `image_embedding_cache`, `voice_message_cache` | cap. 08 |
| Ack rápido + processamento em background | `EdgeRuntime.waitUntil` no webhook Zernio/Meta | cap. 05 |
| Shadow mode antes de bloquear | `assert-canonical-lead.ts` loga violação sem barrar | cap. 06 |
| RAG | `agent_embeddings` (10,5 k chunks) + `pgvector` + fallback FTS/ILIKE | cap. 06 |

## 1.5 Ambientes, deploy e configuração

- **Deploy do frontend**: Vercel a partir do repositório; `npm run build` (Vite). Domínios: preview Lovable, `print-params-hub.lovable.app`, `admin.smartdent.com.br`, `parametros.smartdent.com.br`, `s.smartdent.com.br` (encurtador).
- **Deploy do backend**: Edge Functions publicadas pela plataforma Lovable; `supabase/config.toml` declara ~185 funções, quase todas com `verify_jwt = false`. `piperun-api-test` está `enabled = false`.
- **Migrações**: `supabase/migrations/*.sql`, geradas exclusivamente pela ferramenta de migração.
- **Segredos** (76 nomes em uso, via `Deno.env.get`): PipeRun, Omie, Meta, Zernio, Evolution/EvolutionGO, Stripe, Loja Integrada, Google (Drive/Mail/Places/GSC/OAuth), DeepSeek, Gemini, Anthropic, OpenRouter, POE, Lovable, Disparo Pro, ManyChat, PandaVideo, tl;dv, Firecrawl, Astron, Sellflux (legado), tokens internos (`ADMIN_BACKFILL_KEY`, `MCP_AUTH_TOKEN`, `LI_IMPORT_SHARED_SECRET`, `PIPERUN_WEBHOOK_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `ZERNIO_WEBHOOK_SECRET`).
- **Chaves no bundle**: `src/integrations/supabase/client.ts:5-6` embute URL + anon key (esperado; a defesa real é RLS).
- **Realtime desligado**: `src/integrations/supabase/client.ts:19-31` sobrescreve `channel`/`removeChannel` com no-ops (`REALTIME_DISABLED_EMERGENCY = true`). Todo código que assina Realtime — incluindo `useRealtimeUpdates.ts` e `SmartOpsSystemHealth.tsx:99-110` — está inerte. Atualização de tela é por refetch/remount.

## 1.6 Dependências entre módulos

```text
Captação (Meta/Zernio/forms/e-com/WA)
        │ smart-ops-ingest-lead
        ▼
Identidade (lia_attendances + merged_into + identity_keys)
        │ smart-ops-lia-assign  ←── _shared/golden-rule-guard, commercial-intent
        ▼
CRM PipeRun (Person/Company/Deal) ──► deals / deal_items (espelho) ──► Painel Comercial (cache)
        │                                        ▲
        │                                        │ omie-sync-nf / nfse
        ▼                                    Omie (ERP)
Relacionamento: WhatsApp · Email · SMS · NPS · Reativação · Social
        ▲
        └── Cursos/Treinamentos (deal_id como âncora) e Base de Conhecimento/RAG
```

Acoplamentos críticos (quebram vários módulos se alterados):

1. `lia_attendances` — tabela-pivô do CDP; 610 colunas; lida por praticamente todo o backend.
2. `_shared/golden-rule-guard.ts` + `_shared/commercial-intent.ts` — porteiros de criação de Deal.
3. `deals`/`deal_items` — base de todo BI e do Painel Comercial.
4. `team_members` — credenciais por instância WhatsApp, distribuição de leads e metas.
5. `system_a_catalog` + `catalog_product_variations` + `produto_aliases` — resolução de SKU para propostas, catálogo e social.