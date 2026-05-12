# Diagnóstico — "Não consigo criar um novo formulário"

## Causa raiz
A tabela `smartops_forms` tem **só duas RLS policies**:
- `admin_all_smartops_forms` → `ALL` para `is_admin(auth.uid())`
- `anon_read_active_forms` → `SELECT` para qualquer um quando `active=true`

Resultado: **somente usuários com `user_roles.role='admin'` conseguem inserir**. Hoje, na `user_roles`:
- `admin`: `danilohen@gmail.com`, `pesquisa@smartdent.com.br`
- `author`: `thiago.nicoletti@smartdent.com.br`, `mdguerra@smartdent.com.br`

Quem está logado como `author` clica em "Criar formulário SDR — Captação", o INSERT é bloqueado pelo RLS e o `handleCreate` em `SmartOpsFormBuilder.tsx` mostra `toast.error("Erro: new row violates row-level security policy ...")` (provavelmente passou despercebido).

Confirmado: o último form criado foi em **06/abr/2026** — desde então ninguém conseguiu criar (consistente com a tese: virou tarefa só de admin).

Não há erro de schema (constraint `form_purpose` aceita `sdr_captacao`), nem bug no front. É **autorização**.

## Plano (somente RLS, sem mexer em UI)

### 1. Migration: liberar gestão de formulários para `author`
Adicionar policies em `smartops_forms` permitindo `INSERT/UPDATE/DELETE` para usuários com role `admin` OU `author` (mantém `anon_read_active_forms` intacto). Usar `has_role(auth.uid(), 'author')` + `is_admin(auth.uid())`.

```sql
create policy "authors_manage_smartops_forms"
on public.smartops_forms
for all
to authenticated
using (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'author'))
with check (public.is_admin(auth.uid()) or public.has_role(auth.uid(), 'author'));
```

(A policy antiga `admin_all_smartops_forms` continua, sem conflito — RLS é OR entre policies.)

### 2. Replicar nas tabelas dependentes
Mesmo padrão para que o autor consiga editar o formulário recém-criado:
- `smartops_form_fields` (campos do form)
- `smartops_form_submissions` (já tem INSERT público; só garantir SELECT/DELETE para author)
- `smartops_form_field_responses` (workflow 7×3)

Verificar antes via `pg_policies` e só adicionar se faltar a permissão equivalente.

### 3. Validação
- Logar como `mdguerra@smartdent.com.br`, abrir `/admin → SmartOps → Formulários`, clicar **Novo Formulário**, escolher **SDR — Captação**, digitar nome e criar.
- Conferir que o form aparece na lista e abre o editor `SmartOpsSdrCaptacaoEditor`.
- Conferir que `anon` ainda consegue ler o form público em `/f/:slug`.

## O que NÃO será alterado
- UI do `SmartOpsFormBuilder` (já está correta).
- Lógica de `handleCreate` / `handleCreateBaseForm`.
- Função `is_admin()` nem hierarquia de roles.
- Policy de leitura pública (`anon_read_active_forms`).

## Alternativa (mais rápida, menos sustentável)
Promover `thiago.nicoletti` e `mdguerra` para `admin` em `user_roles`. Resolve hoje, mas qualquer novo author terá o mesmo problema — por isso o plano principal é via RLS.
