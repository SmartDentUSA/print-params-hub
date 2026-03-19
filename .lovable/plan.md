
Diagnóstico confirmado para `gustavoadolfojjt@gmail.com`:

- O lead já tem `proprietario_lead_crm = Patricia Gastaldi` e `piperun_owner_id = 47675`.
- O `piperun_raw_payload` já contém `user` e `proposals[].items[]` com código/referência.
- O problema é que o card lê principalmente `piperun_deals_history`, e o snapshot salvo hoje está pobre:
  - sem `owner_name`
  - sem `proposals`
  - portanto sem número da proposta e sem SKU correto
- Além disso, o `smart-ops-sync-piperun` salva propostas no histórico, mas ainda reduz os itens para `item_id/nome/...`, sem preservar `code/reference/sku`. Isso explica SKU errado mesmo após sync.
- Há um risco extra: `piperun-full-sync` hoje também grava snapshot pobre e pode sobrescrever um snapshot rico depois.

Plano de correção:

1. Unificar o formato do snapshot de negócio
   - Criar um builder compartilhado para `dealSnapshot` + `proposalSnapshots` + `proposalItems` em `supabase/functions/_shared/piperun-field-map.ts` (ou helper compartilhado equivalente).
   - Esse builder deve sempre incluir:
     - `owner_name`, `owner_email`
     - `proposals[]`
     - em cada proposta: `id`, `sigla/initials`, `vendedor`
     - em cada item: `name/nome`, `item_id`, `code`, `reference`, e um campo SKU normalizado

2. Corrigir o webhook do PipeRun
   - Arquivo: `supabase/functions/smart-ops-piperun-webhook/index.ts`
   - Trocar o snapshot enxuto atual por esse snapshot rico.
   - Resultado esperado: leads novos já entram com vendedor, número da proposta e SKU correto no `piperun_deals_history`, sem depender de sync posterior.

3. Corrigir o sync incremental/full
   - Arquivo: `supabase/functions/smart-ops-sync-piperun/index.ts`
   - Passar a usar o mesmo builder compartilhado.
   - Preservar SKU real do item com prioridade tipo:
     `sku normalizado = item.sku || item.code || item.reference || item.external_code || item.item_id`
   - Isso garante que o card não mostre `item_id` quando existe código comercial melhor.

4. Corrigir o `piperun-full-sync`
   - Arquivo: `supabase/functions/piperun-full-sync/index.ts`
   - Hoje ele ainda grava histórico resumido. Precisa ser alinhado ao mesmo snapshot rico.
   - Isso evita regressão futura: um full sync não pode “apagar” `owner_name`, `proposals` e SKU do histórico.

5. Backfill dos leads já afetados
   - Após corrigir os 3 fluxos, reprocessar pelo menos o pipeline do lead afetado (CS Onboarding / deal `49381674`) para reconstruir o `piperun_deals_history`.
   - Isso deve fazer o card passar a mostrar:
     - vendedor da proposta
     - número/id da proposta
     - SKU/código correto dos itens

Arquivos envolvidos:
- `supabase/functions/_shared/piperun-field-map.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`
- `supabase/functions/smart-ops-sync-piperun/index.ts`
- `supabase/functions/piperun-full-sync/index.ts`

Detalhe técnico importante:
- Não é um bug principal do `LeadDetailPanel`.
- O frontend já sabe renderizar proposta/SKU/vendedor quando esses dados existem no `piperun_deals_history`.
- O problema real é inconsistência entre os 3 pipelines de ingestão/sync do PipeRun, que hoje salvam snapshots diferentes do mesmo deal.
