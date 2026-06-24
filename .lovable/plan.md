## Root cause — duplicação Flavia Flores (#61299540)

Cronologia (lead `c130e787…`, person 47287317, deal cacheado #61294351):

```
18:45:26  piperun-person-contact-backfill  → status 429 (rate limit PipeRun)
18:45:46  smart-ops-lia-assign             → person resolution OK (cached)
18:45:48  smart-ops-lia-assign             → deal_created #61299540  ❌ duplicado
18:50:06  smart-ops-lia-assign (redelivery)→ preserve_vendas keeping 61299540
                                            duplicatas detectadas: [61294351, 61211824, 61268120]
```

PipeRun começou a throttlar (429) 22s antes da entrada do form. Quando `lia-assign` chamou `findPersonDeals(personId=47287317)` para aplicar a Golden Rule, a chamada retornou **lista vazia** (resposta 200 sem itens ou 429 silenciosamente convertido). O fail-safe atual só dispara quando `fetched_ok=false`; um array vazio "ok" passa direto e o fluxo entra em `createNewDeal`. Resultado: novo deal mesmo com `lead.piperun_id=61294351` em VENDAS aberto há <30 dias.

## Correção — Cached Deal Validator (defesa adicional)

Adicionar um **3º guard** que executa logo antes de qualquer `createNewDeal` no fluxo primário e SDR:

1. Se `lead.piperun_id` existe → buscar o deal direto via `GET /deals/{id}` (1 chamada, não depende de listagem por person).
2. Se a resposta indicar pipeline = VENDAS, status = aberto e `created_at` < 30 dias → **preservar** esse deal e abortar a criação. Registrar `flow_type=preserve_cached_deal_validated`.
3. Se a chamada falhar (4xx/5xx/timeout) → preservar mesmo assim (`flow_type=preserve_cached_on_validation_failure`), pois a lista vazia que motivou o create já é suspeita.
4. Só liberar `createNewDeal` quando o deal cacheado realmente não existe, está fechado ou já saiu de VENDAS.

Também: marcar `findPersonDeals` para tratar `status === 429` (ou body vazio sem `data`) como `fetched_ok=false`, alimentando o fail-safe existente.

### Arquivos a editar (build mode)

- `supabase/functions/_shared/golden-rule-guard.ts`
  - nova função `validateCachedDealIsActiveVendas(piperunId, env)` que faz `GET /deals/:id`, retorna `{ preserve: boolean, reason: string, deal?: any }`.
  - exportar constantes `VENDAS_PIPELINE_IDS` reaproveitando o que já existe em lia-assign.
- `supabase/functions/smart-ops-lia-assign/index.ts`
  - em `findPersonDeals`: tratar status ≠ 200 (em especial 429) como `fetched_ok=false`; logar `error_type=piperun_find_person_deals_throttled` em `system_health_logs`.
  - imediatamente antes de cada `createNewDeal` (fluxo principal e SDR-Captação), após o `claimDealCreateSlot` e o re-fetch `piperun_id`, chamar `validateCachedDealIsActiveVendas`. Se `preserve=true`, registrar `vendas_duplicates_detected_noop` + `deal_enriched_via_redelivery` (igual ao caminho de redelivery) e retornar sem criar.
- `mem://architecture/golden-rule-deal-create-lock`
  - acrescentar bullet: "Cached Deal Validator: antes de createNewDeal, valida `lead.piperun_id` via GET /deals/:id; só cria se o deal cacheado realmente não está em VENDAS aberto <30d."

### Como verificar

1. Após deploy, conferir `system_health_logs` por `flow_type=preserve_cached_deal_validated` em redeliveries seguintes.
2. Reprocessar manualmente o lead Flavia (`c130e787…`) com um payload de re-delivery e confirmar que nenhum novo deal nasce.
3. Limpar deals duplicados abertos (`61294351`, `61268120`, `61211824`, `61299540` → manter só o mais recente em VENDAS conforme regra).

### O que NÃO mudar

- Estrutura do lock atômico (`smartops_golden_rule_deal_locks`) — segue como está.
- Pipelines protegidos (CS Onboarding, Ganhos Aleatórios) — sem alteração.
- Smart Merge / identidade — sem alteração.
