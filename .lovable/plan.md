## Diagnóstico — `jolukower@hotmail.com`

O lead **existe** e está **canônico** (`merged_into = null`), id `7004f9a4-…`. O `piperun_deals_history` contém **2 deals** corretamente sincronizados com o Piperun:

| Deal | Criado em | Status | Pipeline | Stage | Owner |
|---|---|---|---|---|---|
| `53550374` "Joyce Lukower" | 2025-11-03 | **ganha** | (Lista Clientes Internos → CS) | Novos clientes | Patricia Gastaldi |
| `54298853` "Joyce Lukower - ioConnect" | **2025-11-26** | **aberta** | Funil de vendas | Contato Feito | **Janaina Santos** |

No CRM hoje o deal “vivo” é o **54298853 (Janaina / Funil de vendas / Contato Feito)**. Mas as colunas row-level do `lia_attendances` mostram o deal antigo:

```
piperun_id              = 53550374          (deveria ser 54298853)
proprietario_lead_crm   = Patricia Gastaldi (deveria ser Janaina Santos)
status_atual_lead_crm   = Novos clientes    (deveria ser Contato Feito)
funil_entrada_crm       = CS Onboarding     (deveria ser Funil de vendas)
status_oportunidade     = ganha             (deveria ser aberta — tem deal aberta mais nova)
```

### Causa raiz

1. `smart-ops-piperun-webhook` (linhas 597–622) **sobrescreve** `piperun_id`, owner, stage, pipeline com o último evento recebido — ou seja, “quem chegar por último vence”.
2. `_shared/lead-enrichment.ts` (`ALWAYS_UPDATE`) inclui `proprietario_lead_crm` e `status_oportunidade`, mas **NÃO** inclui `status_atual_lead_crm`, `funil_entrada_crm`, `piperun_id`, `piperun_pipeline_*`, `piperun_stage_*`. Por serem `ENRICHMENT_ONLY`, uma vez preenchidos pelo deal antigo nunca mais são reescritos no fluxo de sync.
3. `smart-ops-sync-piperun` re-sincroniza o `piperun_id` corrente do lead (53550374, ganho) — então fica num loop reforçando a foto antiga, mesmo quando o histórico JSONB já recebeu o deal novo via `piperun-full-sync`.

Resultado: o JSONB está certo, mas o snapshot achatado da linha está errado.

## Plano

### 1. Helper compartilhado `pickPrimaryDeal()`
Novo arquivo `supabase/functions/_shared/piperun-primary-deal.ts`:

- Input: `piperun_deals_history: PiperunDeal[]`.
- Regra de seleção (em ordem):
  1. Deal **aberto** (`status='aberta'` ou `status_oportunidade='aberta'`) com **maior `created_at`**.
  2. Senão, deal mais recente por `closed_at`.
  3. Senão, deal mais recente por `created_at`.
  4. Empate → maior `deal_id`.
- Output: deal escolhido + payload achatado (`piperun_id`, `proprietario_lead_crm`, `status_atual_lead_crm`, `funil_entrada_crm`, `piperun_pipeline_id/name`, `piperun_stage_id/name`, `piperun_owner_id/email`, `status_oportunidade`, `valor_oportunidade`, `data_fechamento_crm`).

### 2. Aplicar o helper em 3 pontos de escrita

a. **`smart-ops-piperun-webhook/index.ts`** — após montar `updateData` e atualizar/inserir o JSONB, recomputar campos row-level com `pickPrimaryDeal(historyAfterMerge)` e sobrescrever `updateData` com o resultado. Garante que webhooks de deals antigos (won, lost, reactivation) não “rebaixem” o snapshot.

b. **`smart-ops-sync-piperun/index.ts`** — idem, antes do `update`. Também passar a sincronizar com o `piperun_id` do **deal primário**, não com o `piperun_id` salvo (que pode estar travado no deal antigo).

c. **`piperun-full-sync/index.ts`** — após escrever cada deal no histórico, recomputar snapshot via helper.

### 3. Atualizar `_shared/lead-enrichment.ts`
Mover para `ALWAYS_UPDATE` os campos de snapshot do CRM (eles passam a ser determinísticos via `pickPrimaryDeal`, então faz sentido sempre refletirem a verdade):
- `status_atual_lead_crm`, `funil_entrada_crm`
- `piperun_pipeline_id`, `piperun_pipeline_name`, `piperun_stage_id`, `piperun_stage_name`
- `piperun_owner_id`, `piperun_owner_email`
- `data_fechamento_crm`

Manter `piperun_id` como **PROTECTED contra null** mas permitir overwrite quando `pickPrimaryDeal` indicar outro id.

### 4. Backfill 1x
Edge function efêmera `backfill-primary-deal` (ou bloco em `piperun-full-sync` rodado uma vez) que:
- Itera `lia_attendances WHERE merged_into IS NULL AND jsonb_array_length(piperun_deals_history) > 1` em páginas de 200.
- Para cada lead, roda `pickPrimaryDeal` e faz `update` apenas dos campos snapshot.
- Loga before/after no `lead_enrichment_audit` com `source='backfill_primary_deal'`.

Para o caso da Joyce, o backfill resultará em:
```
piperun_id            = 54298853
proprietario_lead_crm = Janaina Santos
status_atual_lead_crm = Contato Feito
funil_entrada_crm     = Funil de vendas
status_oportunidade   = aberta
data_fechamento_crm   = NULL
```

### 5. UI — `KanbanLeadDetail` / Hero card
Sem mudanças funcionais. Adicionar um pequeno tooltip “Deal primário: #{piperun_id} — selecionado entre N deals” para transparência.

### 6. Memória
Atualizar `mem://smart-ops/lead-card-business-intelligence-tables-v4` (ou criar `mem://smart-ops/primary-deal-selection-v1`) com a regra: **Snapshot row-level do CRM = deal aberto mais recente; ganhos/perdidos antigos não rebaixam o snapshot.**

## Arquivos a alterar

- `supabase/functions/_shared/piperun-primary-deal.ts` (novo)
- `supabase/functions/_shared/lead-enrichment.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`
- `supabase/functions/smart-ops-sync-piperun/index.ts`
- `supabase/functions/piperun-full-sync/index.ts`
- `supabase/functions/backfill-primary-deal/index.ts` (novo, efêmero)
- `mem://smart-ops/primary-deal-selection-v1` (novo)

Sem migrations de schema. Sem mudanças em RLS. Sem novos secrets.

Aprova para eu implementar?
