

# Plano: Corrigir Todos os Endpoints Outbound para Exportação Completa

## Diagnóstico

Após auditoria completa dos 8 endpoints, identifiquei 3 com problemas críticos que impedem o Sistema A de capturar todas as informações geradas:

### Problemas Encontrados

| Endpoint | Problema | Impacto |
|---|---|---|
| `export-processing-instructions` | Parser ignora headers Markdown (`## PRÉ-PROCESSAMENTO`) — retorna arrays vazios | 100% das instruções parseadas perdidas |
| `knowledge-feed` | Exporta apenas categorias C, D, E. Falta campos traduzidos (en/es). FAQs duplicadas | Sistema A não recebe artigos de Vídeos (A), Troubleshooting (B), Parâmetros (F) |
| `data-export` | Mesmo bug do parser. Falta 15+ colunas novas de `knowledge_contents`. N+1 queries causam timeout | Campos traduzidos, veredict_data, answer_block, recommended_products, ai_context — tudo ausente |

### Dados Ausentes no `data-export` e `knowledge-feed`

Colunas de `knowledge_contents` não exportadas:
- **Traduzidos**: `title_en`, `title_es`, `excerpt_en`, `excerpt_es`, `content_html_en`, `content_html_es`, `faqs_en`, `faqs_es`
- **Conteúdo enriquecido**: `veredict_data`, `answer_block`, `technical_properties`, `recommended_products`
- **Metadados científicos**: `is_medical_device`, `is_scholarly`, `norm_references`
- **Geolocalização**: `geo_city`, `geo_state`, `geo_state_code`, `client_name`, `client_specialty`
- **IA**: `ai_context`, `ai_context_en`, `ai_context_es`

Coluna de `resins` não exportada: `ai_context`

**Escala**: 770 artigos ativos, 189 com traduções EN/ES, 712 com answer_block, 770 com recommended_products.

---

## Correções Planejadas

### 1. `export-processing-instructions/index.ts`
Corrigir `parseInstructions()` para reconhecer headers Markdown:
- Regex: `^#{1,3}\s*(?:PRÉ|PRE)[-\s]?PROCESSAMENTO`
- Regex: `^#{1,3}\s*(?:PÓS|POS)[-\s]?PROCESSAMENTO`
- Aceitar subsections (`### Lavagem`, `### Remoção`) como continuation do section atual
- Aceitar bullets indentados (`  •`)
- Aceitar sections extras como `## CALCINAÇÃO` como post-processing

### 2. `knowledge-feed/index.ts`
- Expandir para **todas as categorias A-F** (não apenas C, D, E)
- Adicionar parâmetro `?categories=A,B,C` para filtro opcional
- Adicionar campos traduzidos no JSON: `title_en`, `title_es`, `excerpt_en`, `excerpt_es`
- Deduplica FAQs por `question`
- Aumentar limit default para 50 (max 500)
- Usar `SERVICE_ROLE_KEY` em vez de `ANON_KEY` para acesso completo

### 3. `data-export/index.ts`
- Corrigir `parseProcessingInstructions()` (mesma lógica do fix 1)
- Expandir `fetchKnowledgeContents` select para incluir todas as colunas novas
- Adicionar campos traduzidos, veredict_data, answer_block, technical_properties, recommended_products, metadados científicos e geolocalização no output (compact, full, ai_ready)
- Adicionar `ai_context` na query de resins
- Otimizar N+1 queries: usar batch selects para keywords e parameter counts em vez de loops individuais

## Arquivos Afetados

1. `supabase/functions/export-processing-instructions/index.ts` — fix parser Markdown
2. `supabase/functions/knowledge-feed/index.ts` — expandir categorias, traduções, dedup FAQs
3. `supabase/functions/data-export/index.ts` — fix parser, adicionar 15+ colunas, otimizar queries

## Endpoints Sem Problemas (confirmados OK)

- `export-parametros-ia` — 260 parâmetros exportados corretamente
- `get-product-data` — fuzzy matching funcional
- `generate-sitemap` — todas as rotas incluídas
- `generate-knowledge-sitemap` — categorias A-G + artigos
- `generate-documents-sitemap` — PDFs com lastmod correto

