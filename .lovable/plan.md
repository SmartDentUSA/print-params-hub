
# Correção: UNIQUE constraint ausente em `company_kb_texts`

## Causa raiz

A migration criou a tabela `company_kb_texts` sem a constraint `UNIQUE(title, source_label)`. A edge function `ingest-knowledge-text` usa `.upsert({ onConflict: "title,source_label" })`, o que exige que exista um índice único nesses campos no banco — do contrário, o Postgres retorna exatamente o erro visto:

```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

## Solução — 1 migration de correção

Adicionar o índice único que estava faltando, via nova migration SQL:

```sql
-- Índice único para suportar o upsert por title + source_label
-- source_label pode ser NULL, então usamos COALESCE para tratar NULLs como string vazia
CREATE UNIQUE INDEX company_kb_texts_title_source_label_idx
  ON public.company_kb_texts (title, COALESCE(source_label, ''));
```

O motivo de usar `COALESCE(source_label, '')` é que no Postgres, `NULL != NULL` — dois registros com `source_label = NULL` e o mesmo `title` não seriam detectados como conflito por um índice normal. O `COALESCE` resolve isso tratando NULL como string vazia para efeito do índice.

A edge function **não muda** — o `.upsert({ onConflict: "title,source_label" })` já está correto e vai funcionar assim que o índice existir.

## Arquivos modificados

| Arquivo | Ação | Risco |
|---|---|---|
| `supabase/migrations/XXXXXX_fix_company_kb_unique.sql` | Adicionar `CREATE UNIQUE INDEX` na tabela existente | Zero — adição de constraint, zero dados perdidos |

## Nenhuma outra mudança

- Edge function `ingest-knowledge-text` — inalterada (já está correta)
- `AdminApostilaImporter.tsx` — inalterado
- `AdminDraLIAStats.tsx` — inalterado

Após a migration, o upload do DOCX de transcrições vai funcionar normalmente: primeiro upsert insere o registro, re-upserts subsequentes do mesmo `title + source_label` atualizam o conteúdo em vez de duplicar.
