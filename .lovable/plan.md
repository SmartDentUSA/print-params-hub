

# Plano: Lead Intelligence Card v2 — Rewrite Completo

## Resumo

Reescrever completamente `LeadDetailPanel.tsx` (~1129 linhas → ~1200 linhas) e `intelligence-dark.css` (~425 linhas → ~500 linhas) para reproduzir o design v2. Adicionar Google Fonts ao `index.html`.

## Arquivos a Modificar

### 1. `index.html` — Adicionar Google Fonts
Adicionar `<link>` para DM Sans, Syne, DM Mono no `<head>`.

### 2. `src/styles/intelligence-dark.css` — Reescrever CSS
**Manter intacto**: Classes da sidebar/lista usadas por `SmartOpsLeadsList.tsx` (`.intel-split`, `.intel-sidebar`, `.intel-lead-row`, `.intel-avatar`, `.intel-lr-*`, `.intel-tag-*`, `.intel-lis-micro`, `.intel-filt`, `.intel-search-input`, `.intel-topbar`, etc.)

**Substituir**: Todas as classes do detail panel por novas classes v2 conforme spec CSS do prompt (hero, tabs, stats-row, ai-panel, cog-grid, timeline, deal-table, upsell-grid, lis-breakdown, action-list, ticket-card, etc.)

**Novas CSS vars** dentro de `.intel-dark`: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`, `--accent`, `--accent2`, `--accent3`, `--blue`, `--purple`, `--hot`, `--warm`, `--cold`, `--text`, `--muted`, `--muted2`.

### 3. `src/components/smartops/LeadDetailPanel.tsx` — Reescrever componente

**Fonte de dados**: Fetch único para `smart-ops-leads-api?action=detail&id={lead.id}` — retorna `{ lead, person, company, opportunities, portfolio, portfolio_embed_url, support_tickets, support_summary }`. Cache por `lead.id`.

**Remover**:
- 10 queries Supabase individuais
- `buildUnifiedTimeline()` de 10 fontes
- Chat tab (state, UI, `sendChatMessage`)
- Merge detection/auto-merge
- Identity Graph
- `buildLeadContext()`
- `callCopilotForTab()` para cognitive/upsell/actions

**Estado simplificado**:
- `detail`, `loading`, `error`, `activeTab` (6 abas), `cachedLeadId`
- `cognitiveLoading`, `cognitiveText` (para botão Reanalisar)

**Análise Cognitiva IA** — usar endpoint dedicado:
```
POST smart-ops-cognitive-analysis { lead_id }
→ { analysis: string, model: "deepseek-chat" }
```
Inicializar `cognitiveText` com `detail.lead.cognitive_analysis?.ai_narrative`. Botão "↺ Reanalisar" chama o endpoint. Badge "DeepSeek v3". Grid cognitivo 2×3 usa campos já salvos no banco (`psychological_profile`, `primary_motivation`, etc.)

**6 Abas** (sem Chat):
1. **Histórico**: Stats row 6 blocos + Deal table do `piperun_deals_history` + Timeline unificada (deals + e-commerce + academy + support_tickets + tags CRM) + Bloco suporte técnico
2. **Cognitiva**: AI panel com `smart-ops-cognitive-analysis` + Grid 2×3
3. **Upsell**: 3 cards de `opportunities[]` + Projeção LTV + Mix produtos
4. **Fluxo**: `<WorkflowPortfolio />` + Gap do Fluxo
5. **LIS**: Score ring SVG + 4 barras eixos + Fórmula + Histórico
6. **Ações**: Lista priorizada de opportunities + chamados abertos + cursos incompletos + imersão

**Hero**: Avatar gradient, buyer type badge, badges contextuais (suporte, academy, carrinho), meta row, LTV (Syne 28px), LIS (Syne 44px), heat badge.

## Arquivos Não Modificados
- `WorkflowPortfolio.tsx` — importado e usado na aba Fluxo
- `SmartOpsLeadsList.tsx` — continua compatível (passa `lead as any`)
- Edge functions — endpoint já deployed e funcional
- Schema do banco — nenhuma migração

