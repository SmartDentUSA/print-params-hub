

# Plano: Corrigir Edge Functions Astron para API real

## Problema

As edge functions `sync-astron-members` e `astron-member-lookup` estao usando a API Astron de forma incorreta. Comparando com a documentacao oficial:

| Aspecto | Implementacao atual | API real |
|---------|-------------------|----------|
| Metodo HTTP | POST com JSON body | **GET com query params** (listClubUsers, listClubUserPlans, getClubUser) |
| Autenticacao | `am_key`/`am_secret` no body JSON | **Basic Auth** (am_key = username, am_secret = password) |
| Paginacao max | limit ate 200 | **limit maximo 50** |
| `club_id` | Nao enviado | **Obrigatório em todas as rotas** |
| Login URL | Campo do user | Rota dedicada **generateClubUserLoginUrl** |

## Alteracoes

### 1. Novo secret: `ASTRON_CLUB_ID`
Precisamos do `club_id` da area de membros. Solicitar ao usuario.

### 2. `supabase/functions/sync-astron-members/index.ts`
- Alterar `astronFetch` para usar **GET** com query params e **Basic Auth** header (`Authorization: Basic base64(am_key:am_secret)`)
- Adicionar `club_id` em todas as chamadas
- Limitar `pageSize` a max 50
- Usar `getClubUser` fields corretos: `id`, `name`, `email`, `phone`, `doc_number`, `time_last_login`
- Usar `listClubUserPlans` com `club_id` + `user_id` como query params
- Usar `generateClubUserLoginUrl` para gerar login URL por aluno

### 3. `supabase/functions/astron-member-lookup/index.ts`
- Mesma correcao do helper `astronFetch` (GET + Basic Auth + club_id)
- Usar `getClubUser` com `user_id=email` para busca por email (a API aceita email no campo user_id)
- `listClubUserPlans` com query params

### Helper corrigido (compartilhado por ambas functions)

```typescript
const ASTRON_BASE = "https://api.astronmembers.com.br/v1.0";

async function astronFetch(endpoint: string, params: Record<string, string> = {}) {
  const amKey = Deno.env.get("ASTRON_AM_KEY")!;
  const amSecret = Deno.env.get("ASTRON_AM_SECRET")!;
  const clubId = Deno.env.get("ASTRON_CLUB_ID")!;

  const qs = new URLSearchParams({ club_id: clubId, ...params });
  const url = `${ASTRON_BASE}/${endpoint}?${qs}`;
  const auth = btoa(`${amKey}:${amSecret}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Basic ${auth}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Astron ${endpoint} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
```

### Paginacao corrigida (sync)

```typescript
// max 50 por pagina conforme documentacao
let pageSize = 50;
// ...
const usersResp = await astronFetch("listClubUsers", {
  page: String(page),
  limit: String(pageSize),
});
```

