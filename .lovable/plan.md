## Achados sobre combos INO 200

Levantei 174 deals **Ganhos** que contêm `INO 200 - BLZ` na proposta:
- **33 listam `RayShape - Edge Mini` como item separado** → já contam no `fn_rayshape_owners` ✅
- **141 NÃO listam Edge Mini explicitamente** → atualmente **não contam** ❌

A função `fn_rayshape_owners` filtra apenas por `item.nome ILIKE '%Edge Mini%'`. Se o combo `INO 200 - BLZ` embute a impressora Rayshape mas não a desmembra como linha separada, esses donos ficam invisíveis na lista Edge Mini.

**Precisa de decisão de negócio antes de mexer no matcher:**
- O combo `INO 200 - BLZ` (item_id/SKU específico) sempre inclui a Rayshape Edge Mini? Ou só algumas versões?
- Existem outros combos (`KIT CHAIRSIDE`, etc.) que também embutem Edge Mini?

## Plano

### Parte 1 — Pull cirúrgico de deals (param `deal_ids`)

Atualizar `supabase/functions/smart-ops-sync-piperun/index.ts`:

1. Adicionar leitura de `url.searchParams.get("deal_ids")` (CSV de IDs, ex.: `47317858,51852538,51909112,56643646`).
2. Quando presente, **pular** o loop de paginação por `pipeline_id`/`updated_since` e fazer `GET /deals/{id}?with[]=person,person.emails,person.phones,...` para cada ID, alimentando o mesmo pipeline de upsert/normalização.
3. Manter `orchestrate=true` válido (cada deal_id vira um "snapshot" individual no chunked pipeline).
4. Logar em `system_health_logs` com `function_name=piperun_sync_targeted`.

Após deploy, invocar:
```
GET /smart-ops-sync-piperun?deal_ids=47317858,51852538,51909112,56643646
```
e validar:
```sql
SELECT piperun_deal_id, lead_id, status, is_deleted
FROM deals WHERE piperun_deal_id IN ('47317858','51852538','51909112','56643646');
```

### Parte 2 — Cobertura combos INO 200 com Rayshape

Sugestão (aguardando confirmação): estender o matcher de `fn_rayshape_owners` para reconhecer combos que embutem a Rayshape. Caminhos possíveis (escolher 1):

**Opção A — Lista branca de SKUs/nomes de combo** (preferida, determinística):
- Criar tabela `rayshape_bundle_skus(sku text PRIMARY KEY, label text, includes_edge_mini boolean)`.
- Popular com SKUs/nomes confirmados pelo time (ex.: `INO 200 - BLZ` quando vendido com Rayshape).
- Ajustar `fn_rayshape_owners` para também aceitar quando algum item da proposta bater nessa lista.

**Opção B — Regex amplo** (`%INO 200%` OU `%Edge Mini%`):
- Mais simples mas pode contar falsos positivos (deals que pegaram só o scanner INO 200 sem impressora).

**Opção C — Status quo + ação operacional**:
- Pedir ao time comercial para sempre desmembrar `RayShape - Edge Mini` como item próprio na proposta, mesmo dentro de combos. Sem mudança de código.

### Parte 3 — Memória

Atualizar `mem://smart-ops/copilot-product-owners-tool` (ou criar `mem://smart-ops/rayshape-owners-matcher-v2`) documentando a regra final de inclusão (apenas Edge Mini explícito vs combos embutidos).

## Perguntas para você

1. Confirmo que adiciono o `deal_ids` ao `smart-ops-sync-piperun` (Parte 1) — ok?
2. Qual opção para combos INO 200: **A (whitelist de SKUs)**, **B (regex amplo)** ou **C (status quo)**? Se A, qual lista de combos sabidamente embutem a Rayshape Edge Mini?
