

## Plano: Corrigir secrets invertidos da Astron API

### Problema
Os logs confirmam que `ASTRON_AM_KEY` contém o hash secret e `ASTRON_AM_SECRET` contém o ID numérico (estão trocados). Resultado: `401 Invalid Credentials`.

Log: `am_key=qrPsJjLGeAsFgESYOfAsKBBxohyCTsPA` — deveria ser `am_key=19177`.

### Correção
Atualizar os dois secrets no Supabase:
- `ASTRON_AM_KEY` → `19177`
- `ASTRON_AM_SECRET` → `qrPsJjLGeAsFgESYOfAsKBBxohyCTsPA`

### Validação
Após atualizar, chamar `sync-astron-members` com `page_size=2, max_pages=1` para confirmar que a autenticação funciona e os dados dos alunos são retornados.

