

## Plano: Corrigir autenticacao Astron Members API

### Problema
A documentacao Apiary confirma: **"Esta e uma API simples, de chamadas via POST/JSON em uma endpoint de consulta."** Todos os endpoints devem ser chamados via **POST** com `am_key` e `am_secret` no body JSON. O codigo atual usa GET por padrao, causando o 403.

### Correcoes

**1. `sync-astron-members/index.ts`**
- Alterar o default do `astronFetch` de `"GET"` para `"POST"`
- Remover a logica de query params (GET branch), manter apenas POST com JSON body
- Todas as chamadas (`listClubUsers`, `listClubUserPlans`) ja passarao a usar POST automaticamente

**2. `astron-member-lookup/index.ts`**
- Mesma correcao: alterar default para `"POST"` e remover branch GET

### Detalhes tecnicos
A funcao `astronFetch` em ambos os arquivos sera simplificada:
```typescript
async function astronFetch(endpoint: string, params: Record<string, unknown> = {}) {
  const url = `${ASTRON_BASE}/${endpoint}`;
  const body = { am_key, am_secret, ...params };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

Apos deploy, testaremos com `sync-astron-members` para validar que a autenticacao funciona.

