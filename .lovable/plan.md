

# Edge Function de Teste Piperun API

## O que sera feito

Criar uma edge function `piperun-api-test` que permite explorar a API do Piperun livremente, retornando o JSON bruto completo para inspecao dos campos disponiveis.

## Alteracoes

### 1. Novo arquivo: `supabase/functions/piperun-api-test/index.ts`

Edge function que aceita um `action` no body e chama a API do Piperun correspondente:

- `list_deals` -- `GET /v1/deals?show=1` (retorna 1 deal com todos os campos)
- `get_deal` -- `GET /v1/deals/{dealId}` (deal especifico com expansoes)
- `list_users` -- `GET /v1/users` (lista vendedores/owners do Piperun)
- `list_stages` -- `GET /v1/stages` (lista etapas/funis)
- `list_pipelines` -- `GET /v1/pipelines` (lista pipelines)
- `raw_get` -- `GET /v1/{path}` (chamada livre para qualquer endpoint)

Cada chamada inclui o header `Token: {PIPERUN_API_KEY}` (secret ja configurada) e retorna o JSON bruto completo sem filtro.

### 2. Registrar no `supabase/config.toml`

```toml
[functions.piperun-api-test]
verify_jwt = false
```

## Resumo

| Arquivo | Acao |
|---|---|
| `supabase/functions/piperun-api-test/index.ts` | Criar -- proxy de teste para API Piperun |
| `supabase/config.toml` | Editar -- registrar nova function |

