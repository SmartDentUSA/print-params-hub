

# Adicionar person_id e company_id ao Rich Deal Snapshot

## Problema
O `RichDealSnapshot` (dentro do array `piperun_deals_history`) não inclui `person_id` nem `company_id`. Esses IDs ficam apenas no nível do lead, o que impede distinguir a pessoa/organização de cada deal individual no histórico.

## Correção

### Arquivo: `supabase/functions/_shared/piperun-field-map.ts`

1. Adicionar dois campos à interface `RichDealSnapshot`:
   - `person_id: number | null`
   - `company_id: number | null`

2. No `buildRichDealSnapshot`, preencher os novos campos:
   - `person_id: deal.person_id ? Number(deal.person_id) : null`
   - `company_id: deal.company_id ? Number(deal.company_id) : null`

### Redeploy
- `smart-ops-sync-piperun` (usa o shared)
- `smart-ops-piperun-webhook` (usa o shared)
- `piperun-full-sync` (usa o shared)

Nenhuma mudança no frontend, banco ou outros arquivos. Os novos campos aparecerão automaticamente no próximo sync/webhook.

