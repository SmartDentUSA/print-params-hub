## Problema

Na aba **Configurações** de reativação, todos os selects de pipelines PipeRun mostram "Erro ao carregar". Causa raiz confirmada:

- O hook `usePiperunPipelines` chama a Edge Function `piperun-list-pipelines`.
- O código da função existe em `supabase/functions/piperun-list-pipelines/index.ts`, mas **não está registrada em `supabase/config.toml`**, então nunca foi deployada.
- Teste direto retorna: `404 {"code":"NOT_FOUND","message":"Requested function was not found"}`.

## Correção

Registrar a função em `supabase/config.toml` adicionando:

```toml
[functions.piperun-list-pipelines]
verify_jwt = false
```

O deploy é automático. Após o deploy, os 5 selects (Pipeline VENDAS, CS, LTV, Etapa LTV, LTV Perdidos) passam a carregar via `PIPERUN_API_KEY` já configurada (usada por `piperun-api-test`).

## Escopo

- Alterar apenas `supabase/config.toml` (adicionar bloco da função).
- Nenhum outro arquivo tocado.
