

## Integração Bidirecional com SellFlux

### Situação Atual

| Direção | URL | Método | Status |
|---------|-----|--------|--------|
| **Enviar → SellFlux** | `.../v2/webhook/custom/afb45b0a...` | POST | Funcionando |
| **Consultar ← SellFlux** | `.../webhook/lead/b9cecca7...?email=` | GET | Novo |

### O que a URL de consulta faz

A URL `https://webhook.sellflux.app/webhook/lead/b9cecca75d277cd77afd8818fd369781?email=X` é uma **API de leitura** do SellFlux. Ao fazer GET com o email do lead, ela retorna os dados e tags atuais desse lead no SellFlux.

Isso permite **sincronização reversa**: puxar tags e dados que foram adicionados no SellFlux (por automações internas dele) e atualizar nosso sistema.

### Plano

**1. Salvar a URL base como secret**
Adicionar `SELLFLUX_LEAD_API_URL` com valor `https://webhook.sellflux.app/webhook/lead/b9cecca75d277cd77afd8818fd369781` (verificar se já está no secret `SELLFLUX_WEBHOOK_LEADS`).

**2. Criar função de consulta no `sellflux-field-map.ts`**
Adicionar `fetchLeadFromSellFlux(email)` que faz GET na URL com `?email=EMAIL` e retorna os dados/tags do lead.

**3. Criar Edge Function `smart-ops-sellflux-sync`**
Nova função que:
- Recebe um email (ou lista de emails)
- Consulta a API GET do SellFlux para cada lead
- Processa as tags retornadas via `migrateLegacyTags()`
- Atualiza `lia_attendances.tags_crm` com as tags atualizadas
- Pode ser chamada manualmente ou em batch para sincronizar tags

**4. Integrar no fluxo existente**
Opcionalmente, chamar essa consulta dentro do `smart-ops-ingest-lead` para enriquecer leads com dados que já existem no SellFlux.

### Resumo dos endpoints

```text
┌─────────────┐    POST /v2/webhook/custom/...    ┌──────────┐
│  Nosso App  │ ──────────────────────────────────→│ SellFlux │
│             │    GET /webhook/lead/...?email=    │          │
│             │ ←──────────────────────────────────│          │
└─────────────┘                                    └──────────┘
```

