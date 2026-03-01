

## Diagnostico

O webhook V1 de Leads (`SELLFLUX_WEBHOOK_LEADS`) **so dispara para leads existentes** (linha 281: `if (SELLFLUX_WEBHOOK_LEADS && existingLead)`). Leads novos nunca sao enviados para esse webhook.

Alem disso, o webhook V2 (Campanhas) dispara mas retorna erro: `"Não foi possível identificar a transação!"` -- isso indica que o webhook de campanhas nao esta configurado corretamente no painel SellFlux para receber leads novos.

### Resultado do teste

| Webhook | Disparou? | Resultado |
|---------|-----------|-----------|
| V1 Leads (GET) | NAO | Condicional `&& existingLead` bloqueia leads novos |
| V2 Campanhas (POST) | SIM | Erro: "Não foi possível identificar a transação!" |

## Correcao

### `smart-ops-ingest-lead/index.ts` - Linha 281

Remover a condicao `&& existingLead` para que o webhook V1 de Leads dispare tambem para leads novos:

```
// ANTES:
if (SELLFLUX_WEBHOOK_LEADS && existingLead) {

// DEPOIS:
if (SELLFLUX_WEBHOOK_LEADS) {
```

Isso garante que todo lead (novo ou existente) seja sincronizado com o SellFlux V1.

### Arquivos alterados

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `supabase/functions/smart-ops-ingest-lead/index.ts` | Remover `&& existingLead` na linha 281 |

### Deploy
- `smart-ops-ingest-lead`

