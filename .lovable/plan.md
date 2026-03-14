

# Plano: Separar tokens Meta por função

## Situação atual
As 3 Edge Functions Meta usam o mesmo secret `META_LEAD_ADS_TOKEN`. Porém, você gerou 3 tokens diferentes (um para cada função).

## O que será feito

### 1. Criar 2 novos secrets no Supabase
- `META_ADS_MANAGER_TOKEN` — token do ads-manager
- `META_ADS_INSIGHTS_TOKEN` — token do ads-insights
- `META_LEAD_ADS_TOKEN` — mantém o token do webhook (já existe)

### 2. Atualizar as Edge Functions

**smart-ops-meta-ads-manager/index.ts** — trocar `META_LEAD_ADS_TOKEN` por `META_ADS_MANAGER_TOKEN` (com fallback para o antigo).

**smart-ops-meta-ads-insights/index.ts** — trocar `META_LEAD_ADS_TOKEN` por `META_ADS_INSIGHTS_TOKEN` (com fallback para o antigo).

**smart-ops-meta-lead-webhook/index.ts** — sem alteração (continua usando `META_LEAD_ADS_TOKEN`).

### 3. Valores dos tokens

| Secret | Valor (token) |
|---|---|
| `META_LEAD_ADS_TOKEN` | `EAATp4uP616EBQxWYqVGvNMvl59v61ZAvzu2...` (webhook) |
| `META_ADS_MANAGER_TOKEN` | `EAATp4uP616EBQ3qBzC6I76wHPvWcng...` (ads manager) |
| `META_ADS_INSIGHTS_TOKEN` | `EAATp4uP616EBQZCm30jbVv3zpQJ6HOV...` (ads insights) |
| `META_WEBHOOK_VERIFY_TOKEN` | `blz_meta_2026_secure` (já configurado) |

### Escopo técnico
- 2 secrets novos adicionados via ferramenta
- 2 Edge Functions editadas (1 linha cada)
- Deploy automático

