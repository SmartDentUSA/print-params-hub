
# Fix: Erro 500 — "column resins.ai_context does not exist"

## Causa raiz

A edge function `enrich-resins-from-apostila` foi escrita esperando uma coluna `ai_context` na tabela `resins`, mas essa coluna nunca foi criada. O erro é:

```
PostgreSQL error 42703: column resins.ai_context does not exist
```

A função usa `ai_context` em dois lugares:
1. No SELECT: `.select("id, name, manufacturer, description, ai_context, meta_description, keywords, processing_instructions")`
2. No UPDATE: `updates.ai_context = newAiContext`

## Solução — 1 migração de banco

Adicionar a coluna `ai_context` à tabela `resins` como `TEXT` nullable (sem default — só é preenchida pelo enriquecimento da apostila).

```sql
ALTER TABLE public.resins
ADD COLUMN IF NOT EXISTS ai_context TEXT;
```

Isso é tudo que é necessário. A edge function já está corretamente implementada para:
- Ler `ai_context` existente para comparar antes de sobrescrever
- Construir um novo `ai_context` rico com `buildAiContext(product)` (keywords, benefits, features, FAQ, specs dos PDFs)
- Atualizar somente se o conteúdo mudou

## O que NÃO muda

- Nenhum código de edge function precisa ser alterado
- Nenhuma mudança no frontend
- Nenhuma política RLS precisa ser criada (a policy existente `Admins can update resins` já cobre o `UPDATE` da coluna nova)
- A coluna é nullable — resinas sem enriquecimento simplesmente ficam com `NULL`

## Resultado esperado após a migração

Ao clicar em "Enriquecer Resinas" novamente:
- A edge function encontra as resinas ativas no banco
- Cruza com os produtos da apostila pelo nome (fuzzy matching)
- Atualiza `description`, `meta_description`, `keywords` e agora também `ai_context` com o contexto rico construído a partir de benefits, features, FAQ, specs técnicas e palavras-chave do arquivo
- A Dra. L.I.A. poderá usar esse `ai_context` para respostas mais ricas sobre resinas

## Seção Técnica

- A coluna `ai_context TEXT` é idêntica em tipo à `ai_context` já existente em `knowledge_contents` (mesmo padrão do projeto)
- `ADD COLUMN IF NOT EXISTS` é seguro para executar múltiplas vezes
- O `updated_at` das resinas enriquecidas será atualizado automaticamente pela edge function (`updates.updated_at = new Date().toISOString()`)
- Nenhum dado existente é perdido

