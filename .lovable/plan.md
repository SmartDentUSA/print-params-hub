## Problema

A função `fn_search_deals_for_training` (migração `20260603122827`) faz `COALESCE(d.deal_title, l.nome)` sobre a tabela `public.deals`, mas essa tabela **não tem coluna `deal_title`** — só `product`, `pipeline_name`, `items_text` etc. Por isso a busca por e-mail no Agendar (Passo 1/5) quebra com `42703: column d.deal_title does not exist`.

O campo `deal_title` existe apenas dentro do JSONB `lia_attendances.piperun_deals_history` (34.919 ocorrências) — onde o COALESCE já está correto.

## Correção

Criar nova migração substituindo a função com o fallback certo para a tabela `deals`:

```sql
COALESCE(NULLIF(d.product,''), d.pipeline_name, l.nome) AS deal_title
```

Aplicado nos dois ramos (busca por e-mail e por ID). Nenhuma outra lógica muda — ordenação (ganha primeiro + closed_at desc), dedupe por `deal_id`, união com history JSONB e GRANT permanecem iguais.

## Arquivos

- **Nova migração** `supabase/migrations/<ts>_fix_search_deals_training_title.sql` com `CREATE OR REPLACE FUNCTION public.fn_search_deals_for_training(text)` corrigida.

Sem mudança no frontend, em `types/courses.ts` ou no hook `useDealSearch` — o shape de retorno é idêntico.
