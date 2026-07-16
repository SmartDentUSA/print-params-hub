## Problema

Registrei `piperun-list-pipelines` em `supabase/config.toml`, mas o endpoint continua retornando `404 NOT_FOUND`. A causa é o import inválido no topo do arquivo:

```ts
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
```

Esse subpath não existe no pacote — o boot da função falha silenciosamente e o runtime deixa de servi-la (404). Outras funções que funcionam (ex.: `piperun-api-test`) definem `corsHeaders` inline.

## Correção

Substituir o import quebrado por uma constante local no arquivo `supabase/functions/piperun-list-pipelines/index.ts`:

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Nenhuma outra alteração. Após o deploy automático, os 5 selects de pipelines (VENDAS, CS, LTV, Etapa LTV, LTV Perdidos) passarão a carregar.

## Escopo

- Editar apenas `supabase/functions/piperun-list-pipelines/index.ts` (trocar o import por const inline).
