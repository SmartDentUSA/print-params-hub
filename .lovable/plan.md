

# Refatoração e Estabilização do Sistema B

## Escopo Total

6 workstreams, 15+ ficheiros afetados. Foco em manter 100% de compatibilidade — nenhuma query nova, nenhuma tabela removida sem migração.

---

## 1. Modularização da `dra-lia` (5092 → ~1800 linhas no index)

Extrair para `_shared/`:

| Módulo | Linhas | Conteúdo |
|--------|--------|----------|
| `_shared/lia-session-manager.ts` | ~400 | `detectLeadCollectionState`, `upsertLead`, `buildReturningLeadMessage`, `formatLastContactDate`, `classifyLeadMaturity`, ASK_EMAIL/NAME/AREA/SPECIALTY constants |
| `_shared/lia-rag-pipeline.ts` | ~500 | `searchKnowledge`, `searchByILIKE`, `searchCompanyKB`, `searchArticlesAndAuthors`, `searchCatalogProducts`, `searchProcessingInstructions`, `searchParameterSets`, `generateEmbedding`, `applyTopicWeights`, `TOPIC_WEIGHTS` |
| `_shared/lia-commercial-sdr.ts` | ~250 | `buildCommercialInstruction`, maturity instructions (MQL→CLIENTE), `ESCALATION_RESPONSES`, `notifySellerHandoff`, `notifySellerEscalation` |
| `_shared/lia-lead-extraction.ts` | ~200 | `extractImplicitLeadData` (UF, equipment, CAD software, volume, products NLP, competitor detection) |
| `_shared/lia-printer-dialog.ts` | ~400 | All printer dialog state machine: `detectPrinterDialogState`, `fetchActiveBrands`, `fetchBrandModels`, `fetchAvailableResins`, `findBrandInMessage`, `findModelInList`, `findResinInList`, `isOffTopicFromDialog`, ASK_BRAND/MODEL/RESIN constants |
| `_shared/lia-guards.ts` | ~150 | `isGreeting`, `isSupportQuestion`, `isProtocolQuestion`, `isProblemReport`, `isPrinterParamQuestion`, `isMetaArticleQuery`, `upsertKnowledgeGap`, IDK_PATTERNS, GREETING/SUPPORT/PROTOCOL patterns |

O `index.ts` mantém apenas: imports, `Deno.serve`, main handler, stream logic (~1800 linhas).

**Cada módulo exporta funções tipadas.** O index importa tudo via `import { ... } from "../_shared/lia-*.ts"`.

---

## 2. Modularização da `smart-ops-lia-assign` (1196 → ~500 linhas)

Extrair para `_shared/`:

| Módulo | Conteúdo |
|--------|----------|
| `_shared/piperun-hierarchy.ts` | `findPersonByEmail`, `createPerson`, `updatePersonFields`, `findOrCreateCompany`, `fetchCompanyData`, `findPersonDeals`, `createNewDeal`, `updateExistingDeal`, `moveDealToVendas`, `resolveFirstStage` |
| `_shared/waleads-messaging.ts` | `sendWaLeadsMessage`, `buildSellerNotification`, `generateAILeadGreeting`, `sendTemplateMessage`, `triggerOutboundMessages` |

O `index.ts` mantém: handler principal, round-robin, decision tree, update fields.

---

## 3. Deprecação de `products_catalog` → `system_a_catalog`

**Migração em 2 passos:**

1. **Alterar `sync-sistema-a/index.ts`**: Substituir target table de `products_catalog` para `system_a_catalog`, mapeando os campos (`workflow_stages` → `extra_data.workflow_stages`, `anti_hallucination_rules` → `extra_data.clinical_brain.anti_hallucination_rules`).

2. **SQL Migration**: Criar migration para copiar dados existentes de `products_catalog` → `system_a_catalog.extra_data` e marcar a tabela como deprecated (comment).

> **Nota**: A tabela `products_catalog` NÃO será removida nesta fase — apenas deixará de receber escritas. Remoção futura após validação.

---

## 4. Unificação `agent_interactions.lead_id` → `lia_attendances.id`

**Problema atual**: `agent_interactions.lead_id` referencia `leads.id` (tabela legada). O cruzamento com `lia_attendances` requer lookup por email.

**Solução em 3 passos:**

1. **SQL Migration**: Adicionar coluna `lia_id UUID` em `agent_interactions` (nullable, sem FK hard).
2. **Backfill RPC**: Criar função SQL `backfill_agent_interactions_lia_id()` que faz JOIN por email entre `leads` e `lia_attendances` para popular `lia_id`.
3. **Código**: No `dra-lia/index.ts` (agora `_shared/lia-session-manager.ts`), ao inserir `agent_interactions`, popular `lia_id` diretamente quando disponível no `leadState`.

> A coluna `lead_id` existente NÃO será removida — mantém compatibilidade.

---

## 5. Retry Logic para `ingest-lead`

Criar `_shared/resilient-fetch.ts`:

```typescript
export async function resilientFetch(
  url: string, options: RequestInit,
  config: { maxRetries?: number; backoffMs?: number; deadLetterTable?: string }
): Promise<Response | null>
```

- **Retry**: 3 tentativas com backoff exponencial (500ms → 1s → 2s)
- **Dead Letter**: Em caso de falha total, insere em `system_health_logs` com `error_type: "dead_letter"`, payload completo, para reprocessamento manual
- **Aplicar em `ingest-lead`**: Substituir os `fetch().catch()` de `lia-assign`, `cognitive-lead-analysis`, `sendLeadToSellFlux` e `sendCampaignViaSellFlux` por chamadas via `resilientFetch`

---

## 6. Rate Limiting nos Webhooks

Criar `_shared/rate-limiter.ts`:

```typescript
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,  // ex: "meta_webhook", "sellflux_webhook"
  maxPerMinute: number
): Promise<{ allowed: boolean; remaining: number }>
```

**Implementação**: Usa a tabela `system_health_logs` com um `SELECT count(*)` dos últimos 60 segundos para o identifier (zero novas tabelas).

**Aplicar em 3 webhooks:**
- `smart-ops-meta-lead-webhook` (limit: 30/min)
- `smart-ops-sellflux-webhook` (limit: 60/min)
- `smart-ops-piperun-webhook` (limit: 60/min)

Retorna `429 Too Many Requests` quando excedido, com log em `system_health_logs`.

---

## Ordem de Implementação

1. `_shared/resilient-fetch.ts` + `_shared/rate-limiter.ts` (infra base)
2. `_shared/lia-guards.ts` + `_shared/lia-lead-extraction.ts` (módulos menores primeiro)
3. `_shared/lia-printer-dialog.ts` + `_shared/lia-session-manager.ts`
4. `_shared/lia-rag-pipeline.ts` + `_shared/lia-commercial-sdr.ts`
5. Refatorar `dra-lia/index.ts` (imports dos módulos)
6. `_shared/piperun-hierarchy.ts` + `_shared/waleads-messaging.ts`
7. Refatorar `smart-ops-lia-assign/index.ts`
8. Migrar `sync-sistema-a` (products_catalog → system_a_catalog)
9. SQL migrations (lia_id em agent_interactions, backfill)
10. Aplicar retry em `ingest-lead` e rate limiting nos 3 webhooks

## Ficheiros Criados (10 novos _shared)
- `supabase/functions/_shared/resilient-fetch.ts`
- `supabase/functions/_shared/rate-limiter.ts`
- `supabase/functions/_shared/lia-guards.ts`
- `supabase/functions/_shared/lia-lead-extraction.ts`
- `supabase/functions/_shared/lia-printer-dialog.ts`
- `supabase/functions/_shared/lia-session-manager.ts`
- `supabase/functions/_shared/lia-rag-pipeline.ts`
- `supabase/functions/_shared/lia-commercial-sdr.ts`
- `supabase/functions/_shared/piperun-hierarchy.ts`
- `supabase/functions/_shared/waleads-messaging.ts`

## Ficheiros Editados (5)
- `supabase/functions/dra-lia/index.ts` (5092→~1800 linhas)
- `supabase/functions/smart-ops-lia-assign/index.ts` (1196→~500 linhas)
- `supabase/functions/smart-ops-ingest-lead/index.ts` (retry logic)
- `supabase/functions/sync-sistema-a/index.ts` (products_catalog→system_a_catalog)
- 3 webhooks (rate limiting)

