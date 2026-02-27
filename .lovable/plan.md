

## Diagnóstico

Os logs mostram claramente: `am_key=SAuSEvFO5SkrjV31RXnR7nthwUsSoLTs` — isso é o secret da chave "Sistema Master", não da "API Consulta".

Da documentação do usuário:
- **API Consulta**: ID = `19177`, secret = `qrPsJjLGeAsFgESYOfAsKBBxohyCTsPA`
- **Sistema Master**: secret = `SAuSEvFO5SkrjV31RXnR7nthwUsSoLTs`

O sistema está usando a chave errada (Sistema Master ao invés de API Consulta).

## Plano

### 1. Atualizar secrets
- `ASTRON_AM_KEY` → `19177`
- `ASTRON_AM_SECRET` → `qrPsJjLGeAsFgESYOfAsKBBxohyCTsPA`

O código já está correto (envia `am_key` e `am_secret` via POST/JSON). Só os valores dos secrets estão errados.

### 2. Redeployar e testar
- Redeployar `sync-astron-members` para pegar os novos valores
- Chamar com `{"page_size": 2, "max_pages": 1}` para validar autenticação

### Detalhes técnicos
O código em `sync-astron-members/index.ts` e `astron-member-lookup/index.ts` já usa o padrão correto POST/JSON com `{ am_key, am_secret, ...params }`. Nenhuma alteração de código necessária — apenas os valores dos secrets precisam ser corrigidos.

