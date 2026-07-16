## Diagnóstico

Investiguei DNS + resposta HTTP do domínio `parametros.smartdent.com.br`:

- **DNS**: aponta para `vercel-dns-017.com` → hospedagem é **Vercel**, não Lovable.
- `curl -I https://parametros.smartdent.com.br/api/v1/health` retorna `server: Vercel` e `x-served-by: supabase-edge-runtime`, `sb-project-ref: okeogjgqijbfkudfjadz` — ou seja, **o rewrite do vercel.json JÁ está publicado e funcionando**. O proxy está ativo.
- **404 do usuário estava obsoleto** (provavelmente antes do deploy Vercel concluir ou cache). Todos os 5 endpoints agora respondem HTTP 200.
- **Problema real**: o Supabase Functions Gateway entrega à função `smart-dent-api` sempre no path raiz — o subpath (`/api/v1/health`, `/api/v1/resins` etc.) é descartado. Por isso todos os endpoints devolvem a mesma resposta genérica "Smart Dent Knowledge API v1" com a dica `Direct call: add ?path=/api/v1/health`.
- Confirmado: chamando `https://parametros.smartdent.com.br/api/v1/health?path=/api/v1/health` a função responde corretamente com `{"status":"ok","articles_online":605,...}`. A função foi escrita para ler o path via query param `path`.

Portanto o rewrite atual passa o path na URL, mas a função ignora e só olha `?path=`. Precisamos passar o subpath via query param.

## Mudança proposta

Editar apenas o rewrite `/api/v1/:path*` no `vercel.json` (sem tocar em nenhum outro), trocando de:

```json
{
  "source": "/api/v1/:path*",
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-dent-api/api/v1/:path*"
}
```

para:

```json
{
  "source": "/api/v1/:path*",
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-dent-api?path=/api/v1/:path*"
}
```

Os query params originais da requisição (`?printer=elegoo`, `?q=vitality`) são preservados pelo Vercel e concatenados à destination, então a função receberá `?path=/api/v1/parameters&printer=elegoo`.

O rewrite `/ai-search` fica inalterado. Nenhum outro rewrite é tocado.

## Validação

Após deploy no Vercel (~1 min), testar via `curl`:

| Endpoint | Esperado |
|---|---|
| `/api/v1/health` | `{"status":"ok", articles_online:605}` |
| `/api/v1/resins` | lista de resinas |
| `/api/v1/parameters?printer=elegoo` | parâmetros filtrados |
| `/api/v1/search?q=vitality` | resultados de busca |
| `/api/v1/openapi.json` | spec OpenAPI |

## O que NÃO vou fazer

- Não editar outros rewrites do `vercel.json`.
- Não mexer no rewrite `/ai-search` (esse já vai direto para a função `ai-search`, sem subpath — deve funcionar).
- Não editar a edge function `smart-dent-api` (não está no repositório local; é gerenciada externamente).
