
# Auditoria Completa SmartDent Revenue OS

Vou gerar um único arquivo Markdown consolidando uma auditoria 360° do sistema, salvo em `docs/AUDITORIA_COMPLETA_SISTEMA_2026.md` (e cópia em `/mnt/documents/` para download).

## Escopo da auditoria

### 1. Arquitetura & Engenharia
- Stack (React 18 + Vite + TS + Tailwind + shadcn, Supabase, Vercel Edge)
- Topologia: Frontend SPA · Edge Functions (Deno) · Postgres · Cron Jobs · Bot Middleware
- Mapa de integrações externas: PipeRun, Omie, Sellflux, Loja Integrada, Meta CAPI, Evolution API, Google Business, Astron, Panda Video, tl;dv, Zernio
- Inventário de tabelas (190+) agrupadas por domínio (CDP, CRM, ERP, AI, Social, Conteúdo, Cursos)
- Edge Functions ativas e responsabilidades
- Cron jobs e locks de concorrência (cognitive_lock_ttl, smartops_deal_note_locks)

### 2. CDP & Identidade
- Golden Rule (`merged_into IS NULL`)
- Identity cascade (piperun_id > email > phone)
- Lead merge system, Smart Merge, person origin frozen
- Commercial Intent Guard

### 3. Inteligência Artificial
- AI Router (Poe / Lovable Gateway / DeepSeek) com fallback
- Agentes: Copilot (Senior Manager), Dra. LIA (SDR), Cognitive Engine
- RAG architecture v4, threshold 0.56, fallback FTS/ILIKE
- Visual Diagnostic (Gemini Flash Lite)
- Capability Snapshot anti-alucinação
- Logging de tokens (ai_token_usage)
- Modelos por task type (ai_model_routing)

### 4. Receita & BI
- Fórmula: `Max(CRM_Won, Omie_Billing) + LTV_Ecommerce`
- Pipeline funnel 4-bands
- RFM scoring, Intelligence Score (4 eixos, 81pts)
- Revenue gauge, forecast

### 5. SEO / GEO / SERP / E-E-A-T
- Arquitetura AI-First semantic 10/10
- Bot middleware Vercel → seo-proxy SSR Supabase
- llms.txt / llms-full.txt
- Sitemap dinâmico (vídeo, conteúdo, produtos)
- JSON-LD (Article, Product, Person, FAQ, Dataset, BreadcrumbList)
- Person Schema E-E-A-T authors
- Canonical paths Knowledge Base
- Video Search Optimization

### 6. Server-Side / Edge
- Middleware Vercel detecta bots
- SSR proxy para crawlers (Google, GPT, Perplexity)
- Edge functions com `verify_jwt` configuradas
- Per-instance Evolution credentials

### 7. Tracking & Analytics
- GTM-NZ64Q899 dataLayer
- Page views omnichannel (10 tipos)
- Tracking context persistente (sessionStorage)
- Meta CAPI dedup

### 8. Conteúdo & Knowledge Base
- Taxonomia A-G
- Pipeline geração conteúdo (sem preços)
- RAG sobre knowledge_contents/videos/products
- Slug sanitization

### 9. Segurança
- RLS em todas tabelas user-facing
- has_role function (anti-recursão)
- Grants explícitos public schema
- Secrets via Supabase Vault
- Anti prompt injection guards
- service_role nunca no frontend

### 10. Pontos Fortes
- Cobertura ponta-a-ponta lead→cliente→retenção
- Memory architecture (mem://) com 80+ regras versionadas
- Resilência: cascata IA, locks TTL, fallbacks
- AI-First SEO raro no setor

### 11. Gaps & Riscos Identificados
- Google Business Profile API aguardando quota
- Tabelas com RLS off (revisar: agent_actions_log, social_*, cad_*, astron_*)
- `lia_attendances` com 565 colunas (sinal de necessidade de normalização)
- Dependência de credenciais Evolution per-instance
- Algumas migrations sem GRANTs explícitos (verificar)

### 12. Recomendações Priorizadas
- P0: Habilitar RLS em tabelas social_* e cad_* públicas
- P0: Normalização parcial lia_attendances (jsonb spillover)
- P1: Observabilidade unificada (system_health_logs dashboard)
- P1: Substituir Google Reviews v4 (deprecated) por integração alternativa enquanto aguarda quota
- P2: Documentar SLA das cascatas IA
- P2: Lighthouse + Core Web Vitals tracking automatizado

## Entrega

Arquivo único `.md` (~1500-2500 linhas) com:
- Sumário executivo
- Diagramas ASCII (arquitetura, fluxo CDP, cascata IA)
- Tabelas inventário (edge functions, tabelas por domínio, integrações)
- Checklists por dimensão
- Matriz de riscos
- Roadmap de remediação

Saída em `docs/AUDITORIA_COMPLETA_SISTEMA_2026.md` + `<presentation-artifact>` para download.

Aprovando, parto para o build.
