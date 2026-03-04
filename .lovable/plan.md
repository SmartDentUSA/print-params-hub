

# Plano: Intelligence Score Governado — Implementacao Completa

## Correcoes Criticas ao SQL do Usuario

O SQL proposto referencia colunas que **nao existem** na tabela `lia_attendances`. Sem correcao, a migration falha:

| No prompt | Coluna real |
|---|---|
| `phone` | `telefone_normalized` |
| `full_name` | `nome` |
| `crm_contact_id` | `pessoa_piperun_id` |
| `crm_company_id` | `empresa_piperun_id` |
| `crm_deal_id` | `piperun_id` |
| `proposals_count` | nao existe (calcular via `jsonb_array_length(proposals_data)`) |
| `astron_student` | nao existe (usar `astron_status IS NOT NULL`) |
| `astron_courses_enrolled` | `astron_courses_total` |
| `astron_last_access` | `astron_last_login_at` |
| `astron_completion_rate` | nao existe (calcular) |
| `lojaintegrada_total_pedidos` | nao existe |
| `status` (view routing) | `lead_status` |
| `profiles` table (RLS) | usar `is_admin(auth.uid())` |

RPC tambem precisa correcao: `tem_impressora`/`tem_scanner` sao TEXT nao boolean; timeline values sao `3_6_meses` nao `3_6`.

---

## 7 Passos de Implementacao

### PASSO 1 — Migration SQL

Ficheiro: `supabase/migrations/[timestamp]_intelligence_score.sql`

- 3 tabelas novas: `lead_state_events`, `intelligence_score_config`, `backfill_log`
- 12 colunas novas em `lia_attendances`
- 3 indices parciais
- INSERT config v1 (pesos)
- RLS com `is_admin(auth.uid())` (nao `profiles`)
- 5 VIEWs corrigidas para colunas reais (`nome`, `telefone_normalized`, `piperun_id`, etc.)
- View `lead_model_routing` com `lead_status` em vez de `status`

### PASSO 2 — RPC SQL

Ficheiro: `supabase/migrations/[timestamp+1]_rpc_intelligence_score.sql`

`calculate_lead_intelligence_score(p_lead_id uuid)` — SQL puro, SECURITY DEFINER:
- Guard de 60s (nao recalcular se recente)
- Carrega config activa
- 4 eixos com logica corrigida:
  - `sales_heat`: `tem_impressora IS NOT NULL AND tem_impressora != ''` (TEXT, nao boolean)
  - Timeline: `'3_6_meses'`, `'6_12_meses'`, `'indefinido'` (valores reais)
  - Recency: `ultima_sessao_at` (coluna real)
  - Academy: `astron_courses_total > 0` (nao `astron_student`)
- Output JSONB versionado com axes/weights/confidence
- Persiste em `intelligence_score` + `intelligence_score_total` + `intelligence_score_updated_at`

### PASSO 3 — Patch `cognitive-lead-analysis/index.ts`

**3a.** Adicionar helpers no topo (apos imports):
- `STAGE_ORDER` com stages reais: `MQL_pesquisador`, `PQL_recompra`, `SAL_comparador`, `SQL_decisor`, `CLIENTE_ativo`
- `isRegression()` function
- `sha256()` via `crypto.subtle.digest`

**3b.** Expandir SELECT (linha 124) para incluir `intelligence_score, proprietario_lead_crm`

**3c.** Antes do upsert (linha 336), adicionar audit trail:
```
cognitiveData._audit = { prompt_v: 2, model: "deepseek-chat", prompt_hash, context_hash, calculated_at }
```

**3d.** Apos o upsert (linha 355), adicionar:
- State event insert se stage mudou (com `is_regression` e `regression_gap_days`)
- Update campos audit (`cognitive_model_version`, `cognitive_prompt_hash`, `cognitive_context_hash`, `cognitive_analyzed_at`)
- Chamar `supabase.rpc('calculate_lead_intelligence_score', { p_lead_id: leadData.id })`

### PASSO 4 — Patch `smart-ops-ingest-lead/index.ts`

Apos o upsert (linhas 205 e 237), adicionar fire-and-forget:
```
supabase.rpc('calculate_lead_intelligence_score', { p_lead_id: leadId }).catch(...)
```
**Sem** CRM lock — nao ha evidencia de race conditions.

### PASSO 5 — Backfill Edge Function

Novo ficheiro: `supabase/functions/backfill-intelligence-score/index.ts`
- CORS headers
- Batch de 500 leads sem score
- Log em `backfill_log`
- Pausa 500ms entre batches
- Entrada no `config.toml` com `verify_jwt = false`

### PASSO 6 — Dashboard

Novo ficheiro: `src/components/SmartOpsIntelligenceDashboard.tsx`
- Top 20 leads por `intelligence_score_total` (usando `nome`, `telefone_normalized`)
- Pie chart distribuicao por `lead_stage_detected`
- Timeline de `lead_state_events` recentes
- Metricas: tempo medio MQL→SQL, taxa de regressao
- Tipagem TypeScript correcta

### PASSO 7 — Tab Intelligence

Patch `src/components/SmartOpsTab.tsx`:
- Import `SmartOpsIntelligenceDashboard`
- TabsTrigger `"intelligence"` com label "Intelligence"
- TabsContent correspondente

---

## Ficheiros Modificados

| Ficheiro | Acao |
|---|---|
| Migration SQL #1 | 3 tabelas + 12 colunas + indices + config + RLS + 5 VIEWs |
| Migration SQL #2 | RPC `calculate_lead_intelligence_score` |
| `cognitive-lead-analysis/index.ts` | sha256 + audit + state events + RPC call |
| `smart-ops-ingest-lead/index.ts` | RPC call apos upsert |
| `backfill-intelligence-score/index.ts` | Novo |
| `supabase/config.toml` | Entry backfill |
| `SmartOpsIntelligenceDashboard.tsx` | Novo |
| `SmartOpsTab.tsx` | Nova tab |

