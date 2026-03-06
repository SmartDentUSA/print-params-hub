

# Plano: Reescrita Completa da Documentacao Tecnica do Sistema

## Objetivo

Reescrever o documento `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md` com uma abordagem mais completa, cobrindo:

1. **Todas as funcionalidades reais** com descricao tecnica detalhada
2. **Fluxos de criacao de conteudo** (pipeline AI completo)
3. **Qualidade do HTML gerado** e o que fica exposto para IA/SEO
4. **Checklist de funcionalidades reais vs sem funcao** (componentes orfaos, edge functions utilitarias)

## Estrutura do Novo Documento

O documento sera reorganizado em ~2000 linhas com as seguintes secoes:

### PARTE 1 — VISAO GERAL DO SISTEMA
- Resumo executivo atualizado (pos-3 fixes)
- Stack tecnologico completo
- Diagrama de arquitetura (ASCII)

### PARTE 2 — CDP UNIFICADO (lia_attendances)
- Esquema completo (~200 colunas) organizado por dominio
- Views de dominio (v_lead_commercial, v_lead_cognitive, etc.)
- Intelligence Score (LIS) com formula detalhada

### PARTE 3 — LEAD LIFECYCLE (85+ Edge Functions)
- Ingestion (5 entry points)
- CRM Sync & Assignment (PipeRun bidirecional)
- Cognitive Engine (DeepSeek 10 eixos)
- Stagnation & CS Automation
- Integracoes (Astron, Loja Integrada, SellFlux, WhatsApp)
- System Watchdog

### PARTE 4 — CONTENT GENERATION PIPELINE (NOVA SECAO EXPANDIDA)

Detalhamento completo do fluxo de criacao de conteudo:

```
PDF/Video/Texto → Extracao → Orquestracao IA → HTML Formatado → SEO Enrichment → Traducao → Publicacao
```

**Funcoes envolvidas:**
1. `extract-pdf-text` / `extract-pdf-raw` / `extract-pdf-specialized` — extracao de PDFs
2. `extract-and-cache-pdf` — cache de PDFs extraidos
3. `extract-video-content` — extracao de transcricoes de video (PandaVideo)
4. `ai-orchestrate-content` (1193 linhas) — orquestrador central que:
   - Aceita multiplas fontes (rawText, pdfTranscription, videoTranscription, relatedPdfs)
   - Suporta tipos: tecnico, educacional, depoimentos, passo_a_passo, cases_sucesso
   - Suporta documentTypes: perfil_tecnico, fds, ifu, laudo, catalogo, guia, certificado
   - Gera HTML + FAQs + metadata + veredictData + schemas (HowTo, FAQPage)
   - Usa `SYSTEM_SUPER_PROMPT` com regras anti-alucinacao
5. `ai-content-formatter` — formatacao adicional de HTML
6. `reformat-article-html` — reformatacao de HTML existente (Gemini 2.5 Flash, multi-idioma PT/EN/ES)
7. `ai-metadata-generator` — meta descriptions, keywords, OG
8. `ai-generate-og-image` — geracao de OG images via IA
9. `enrich-article-seo` — enriquecimento SEO
10. `auto-inject-product-cards` — injecao automatica de cards de produto no HTML
11. `translate-content` — traducao PT→EN/ES
12. `backfill-keywords` — backfill de keywords
13. `ai-enrich-pdf-content` — enriquecimento de conteudo PDF com IA
14. `ai-model-compare` — comparacao de modelos de impressoras

### PARTE 5 — QUALIDADE DO HTML E EXPOSICAO SEO/IA (NOVA SECAO)

**O que o HTML gerado contem:**
- Classes Tailwind para estilizacao
- Tabelas semanticas `<table>` com `<thead>/<tbody>/<th>/<td>`
- Hierarquia H2/H3/H4 logica
- Links clicaveis (URLs em texto plano → `<a>` tags)
- Regras anti-alucinacao (nao inventa links, dados, CTAs)
- Componentes: `.content-card`, `.benefit-card`, `.cta-panel`

**O que fica exposto para SEO/IA:**

| Elemento | Implementacao | Arquivo |
|---|---|---|
| `<title>` + `<meta description>` | Helmet | `KnowledgeSEOHead.tsx` |
| Organization Schema (JSON-LD) | Dinamico via `useCompanyData` | `SEOHead.tsx` |
| Article Schema (JSON-LD) | `MedicalWebPage` / `TechArticle` / `ScholarlyArticle` | `KnowledgeSEOHead.tsx` |
| Product Schema com Offers | Multi-CTA com `priceValidUntil` | `SEOHead.tsx` |
| Video Schema | `VideoObject` com transcript e duration | `VideoSchema.tsx` |
| FAQ Schema | Auto-extraido de headings com "?" | `KnowledgeSEOHead.tsx` |
| HowTo Schema | 4 metodos de extracao (OL, headings numerados, tabelas, markdown) | `KnowledgeSEOHead.tsx` |
| BreadcrumbList | Hierarquia de navegacao | `SEOHead.tsx` |
| `<meta name="ai-context">` | Contexto semantico para LLMs | `SEOHead.tsx` |
| `llms.txt` | Instrucoes para crawlers IA | `public/llms.txt` |
| `robots.txt` | Allow para GPTBot, ClaudeBot, PerplexityBot | `public/robots.txt` |
| Sitemaps (5) | PT, EN, ES, documentos, principal | Edge functions `generate-*-sitemap` |
| RSS/Atom Feed | `knowledge-feed` | Edge function |
| `seo-proxy` (1854 linhas) | SSR para bots de IA/busca | Edge function |
| `<article itemProp="abstract">` | Resumo tecnico (ArticleSummary) | `ArticleSummary.tsx` |
| Author E-E-A-T | Credenciais completas com CRO | `AuthorSignature.tsx` |
| hreflang | PT/EN/ES alternate links | `KnowledgeSEOHead.tsx` |

### PARTE 6 — FRONTEND COMPLETO

**Paginas publicas:**
- `/` — Hub de parametros de impressao 3D
- `/base-conhecimento` — Knowledge Base (PT/EN/ES)
- `/produtos/:slug` — Pagina de produto
- `/depoimentos/:slug` — Pagina de depoimento
- `/sobre` — Sobre
- `/embed/dra-lia` — Widget embeddavel
- `/f/:slug` — Formularios publicos
- `/docs/:filename` — Proxy de documentos

**Painel Admin** (`/admin`):
- Tabs: Stats, Usuarios, KB, Autores, Catalogo, Videos, Parametros, SmartOps, Dra.LIA
- SmartOps: 12 sub-tabs (Bowtie, Kanban, Leads, Equipe, Automacoes, Logs, Conteudo, Saude, WhatsApp, Formularios, Tokens IA, Intelligence)

### PARTE 7 — CHECKLIST DE FUNCIONALIDADES

**Formato da checklist:**

```
FUNCIONAL / ORFAO / UTILITARIA / STUB
```

**Componentes Frontend orfaos (existem mas NAO sao importados/montados):**
- `SmartOpsReports.tsx` — ORFAO (nunca importado)
- `SmartOpsModelCompare.tsx` — ORFAO (nunca importado)

**Edge Functions utilitarias (one-shot / manutencao):**
- `fix-piperun-links` — Utilitaria (correcao batch de links legados)
- `create-test-articles` — Utilitaria (criacao de artigos de teste)
- `backfill-intelligence-score` — Utilitaria (recalculo batch)
- `backfill-keywords` — Utilitaria (backfill batch)
- `backfill-lia-leads` — Utilitaria (backfill batch)
- `migrate-catalog-images` — Utilitaria (migracao unica)
- `piperun-api-test` — Utilitaria (teste de API)
- `pandavideo-test` — Utilitaria (teste de API)
- `test-api-viewer` — Utilitaria (viewer HTML de teste)

**Edge Functions 100% funcionais (85+):**
Lista completa com status de cada funcao.

### PARTE 8 — SHARED MODULES, SECRETS, BUGS CONHECIDOS

Mesma estrutura do doc atual mas atualizada com os 3 fixes recentes.

## Execucao

Sera um unico arquivo `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md` reescrito completamente, mantendo a mesma localizacao. Estimativa: ~2500 linhas.

