

## Auditoria Completa do Revenue Intelligence OS

### Secao 1: Resumo Executivo

**Status Geral: AMARELO** — O sistema tem arquitetura robusta mas contém 2 bugs criticos em producao, 3 problemas de alto impacto e 5 melhorias medias.

---

### Secao 2: Bugs Criticos Encontrados

#### BUG 1 (CRITICO): `lia-assign` crash no fluxo `preserve_vendas`
**Arquivo:** `supabase/functions/smart-ops-lia-assign/index.ts`, linha 1151
**Problema:** A variavel `piperunFunil` e referenciada no log na linha 1151 mas e declarada somente dentro do bloco `else` (linha 1072). Quando o fluxo e `preserve_vendas`, o codigo lanca `ReferenceError: piperunFunil is not defined`, matando toda a execucao DEPOIS de ja ter atualizado o PipeRun mas ANTES de atualizar a `lia_attendances`.
**Impacto:** Lead fica dessincronizado — PipeRun atualizado, base local nao.
**Fix:** Substituir `piperunFunil` por `updateFields.funil_entrada_crm` no log.

#### BUG 2 (CRITICO): `ecommerce-webhook` LTV sempre = 0
**Arquivo:** `supabase/functions/smart-ops-ecommerce-webhook/index.ts`, linhas 229-232
**Problema:** A API da Loja Integrada retorna `codigo: "pedido_enviado"` (prefixo `pedido_`), mas `PAID_SITUACAO_CODIGOS` contém `"enviado"` sem o prefixo. O `resolveSituacaoCodigo()` retorna o codigo literal do objeto, que nao faz match.
**Evidencia nos logs:** `situacao format sample: {"codigo":"pedido_enviado"}` + `Enrichment: LTV=0 | pedidosPagos=0` — 100% dos webhooks recentes mostram LTV=0.
**Fix:** Adicionar os codigos com prefixo `pedido_` ao set: `"pedido_pago"`, `"pedido_enviado"`, `"pedido_entregue"`, `"pedido_em_producao"`, etc. OU normalizar removendo o prefixo `pedido_` antes da comparacao.

---

### Secao 3: Problemas de Alto Impacto

#### ALTO 1: `piperun-webhook` dispara cognitive-analysis com `SUPABASE_ANON_KEY`
**Arquivo:** `smart-ops-piperun-webhook/index.ts`, linhas 286-293 e 354-361
**Problema:** Usa `SUPABASE_ANON_KEY` no header Authorization em vez de `SERVICE_ROLE_KEY`. Como `verify_jwt = false` na config, funciona mas e uma falha de padrao — se mudar para `verify_jwt = true`, quebra silenciosamente.
**Fix:** Usar `SERVICE_ROLE_KEY` consistentemente.

#### ALTO 2: Idempotencia do `ecommerce-webhook` inexistente
**Problema:** Se a Loja Integrada reenvia o mesmo webhook (retry, duplicata), o sistema processa novamente sem verificar se o pedido ja foi processado. Tags duplicam, LTV pode ser recalculado incorretamente.
**Fix:** Adicionar campo `lojaintegrada_pedidos_processados` (array de IDs) e verificar antes de processar.

#### ALTO 3: `lia-assign` piperun_id sobrescrito em fluxo `preserve_vendas`
**Arquivo:** linha 1078: `if (piperunId && !lead.piperun_id)` — se o lead ja tem `piperun_id`, nao atualiza. Mas se o lead tem um `piperun_id` antigo de um deal perdido e agora tem um deal novo em Vendas, o ID antigo permanece.
**Fix:** Sempre atualizar `piperun_id` com o deal ativo (vendaDeal ou novo deal).

---

### Secao 4: Problemas de Medio Impacto

1. **`astron-member-lookup` sem auto-criacao**: O plano original previa criar usuarios no Astron se nao existissem (`POST + senha hex`), mas a funcao atual so faz lookup. O `lia-assign` ja implementa auto-provisioning separadamente, mas sem o fluxo `GET-POST-Delay-GET` documentado.

2. **`cognitive-lead-analysis` sem timeout no fetch de PipeRun notes**: Linha 207 — `fetchDealNotes` nao tem timeout explicito. Se o PipeRun estiver lento, bloqueia a funcao inteira.

3. **`poll-loja-integrada-orders` sem paginacao completa**: Busca apenas 1 pagina (`batch_size=50`). Se houver mais pedidos novos que 50 desde o ultimo poll, os excedentes sao ignorados ate o proximo ciclo.

4. **`sellflux-webhook` nao protege `entrada_sistema`**: O `ingest-lead` protege via `protectedFields`, mas campos passados via `normalizedPayload` como `proprietario_lead_crm` podem sobrescrever dados de deals abertos em Vendas (viola a Golden Rule).

5. **CORS inconsistente**: Algumas funcoes usam headers expandidos (com `x-supabase-client-*`), outras usam o minimo. Nao causa erro hoje mas pode causar em upgrades do SDK.

---

### Secao 5: Plano de Correcao (Implementacao)

| # | Arquivo | Mudanca | Prioridade |
|---|---------|---------|------------|
| 1 | `smart-ops-lia-assign/index.ts` L1151 | Corrigir referencia a `piperunFunil` — usar `updateFields.funil_entrada_crm` | CRITICO |
| 2 | `smart-ops-ecommerce-webhook/index.ts` L229-232 | Expandir `PAID_SITUACAO_CODIGOS` com codigos prefixados (`pedido_pago`, `pedido_enviado`, `pedido_entregue`, `pedido_em_producao`, `pedido_em_separacao`, `pronto_para_envio`) | CRITICO |
| 3 | `smart-ops-lia-assign/index.ts` L1078 | Sempre atualizar `piperun_id` com o deal ativo, remover `!lead.piperun_id` guard | ALTO |
| 4 | `smart-ops-piperun-webhook/index.ts` L286,354 | Trocar `SUPABASE_ANON_KEY` por `SERVICE_ROLE_KEY` nos fire-and-forget | ALTO |
| 5 | `smart-ops-ecommerce-webhook/index.ts` | Adicionar deduplicacao de pedidos processados | ALTO |
| 6 | Deploy de todas as funcoes corrigidas | Redeploy | — |

### Secao 6: Recomendacoes Futuras

1. **Trigger SQL para recalc LIS on UPDATE**: Criar trigger `AFTER UPDATE ON lia_attendances` que chama `calculate_lead_intelligence_score` quando campos relevantes mudam (urgency_level, tem_impressora, etc.), eliminando a dependencia de chamadas RPC manuais espalhadas.

2. **GIN index em `tags_crm`**: `CREATE INDEX idx_lia_tags_gin ON lia_attendances USING GIN (tags_crm)` — acelera queries de filtragem por tags no dashboard.

3. **Deduplicacao de webhooks via `idempotency_key`**: Adicionar coluna `last_webhook_idempotency` e verificar no inicio de cada webhook.

4. **Circuit breaker centralizado**: Extrair o circuit breaker de `poll-loja-integrada-orders` para `_shared/` e reutilizar no `ecommerce-webhook` e `astron-member-lookup`.

5. **TLDV integration**: Mencionada no briefing original mas nao implementada. Requer: secret `TLDV_API_KEY`, nova edge function `sync-tldv-recordings`, mapeamento para `lia_attendances.tldv_*` fields.

