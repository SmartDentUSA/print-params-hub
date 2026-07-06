## Diagnóstico

O botão "Adicionar" no `PostGruposAddModal` está caindo em `Falha ao adicionar grupos`. Investiguei o banco e o código:

- Tabela `post_group_targets` tem constraint `UNIQUE (group_id)` — não é composto com `instance_name`. Isso significa que um mesmo `group_id` só pode existir em **uma** instância no país inteiro. Qualquer tentativa de inserir um `group_id` já presente (mesmo em outra instância, ou por conta de dedupe/timing) retorna `23505` e o toast dispara.
- Já existem 3 rows para `smartdent_marketing` no banco (RayShape, Exocad, Dashboard) — inserts anteriores passaram, mas o toast de erro continuou aparecendo porque cliques subsequentes/re-tentativas colidem na unique.
- Hoje o toast engole a mensagem real (`toast.error('Falha ao adicionar grupos')`), por isso não dá pra ver `duplicate key value violates unique constraint`.

Uma restrição por `group_id` global também não faz sentido no modelo: `wa_groups` já é particionado por `instance_name` (cada instância tem sua própria linha para o mesmo grupo do WhatsApp, com UUIDs diferentes), então a chave natural aqui é o par `(instance_name, group_id)`.

## Mudanças

### 1. Migration Supabase
Trocar a unique global por composta em `post_group_targets`:

```sql
ALTER TABLE public.post_group_targets
  DROP CONSTRAINT IF EXISTS post_group_targets_group_id_key;

ALTER TABLE public.post_group_targets
  ADD CONSTRAINT post_group_targets_instance_group_uk
  UNIQUE (instance_name, group_id);
```

Sem alteração em RLS, grants, views ou dados existentes (as 5 linhas atuais respeitam a nova unique).

### 2. `src/components/social/PostGruposAddModal.tsx`
No `catch` do insert, mostrar o motivo real do Postgres pra evitar depuração cega em futuros erros:

```ts
if (error) {
  console.error('[post_group_targets] insert error', error);
  return toast.error(`Falha ao adicionar grupos: ${error.message}`);
}
```

Nada mais no fluxo muda: seleção, dedupe por `existingGroupIds`, `onAdded()` continuam iguais.

## Fora de escopo

- Não mexe em `PostGrupos.tsx`, cards, view `v_post_group_targets_detail`, RLS ou grants.
- Não altera edge functions nem o worker de publicação.

## Resultado

- Adicionar um grupo que já pertence a outra instância deixa de falhar.
- Se algum erro futuro acontecer (RLS, FK, etc.), o toast mostra a mensagem real do Postgres.
