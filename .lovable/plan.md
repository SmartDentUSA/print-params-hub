## Diagnóstico

Você está certo: a Seção D ("Identificação MAPEAMENTO de Workflow 7×3") usa `SmartOpsMappingFieldsEditor`, e esse componente **não recebeu o bloco "Exibir apenas se…"** que adicionei só no `SmartOpsFormEditor` (Seção C — Qualificação).

Como os dois editores gravam na **mesma tabela** (`smartops_form_fields`, coluna `conditions`), e o `PublicFormPage` já filtra **todos** os campos via `isFieldVisible`, o runtime já está pronto. Só falta a UI no editor de mapeamento — por isso não aparece a opção lá.

## O que vou fazer

Adicionar em `src/components/SmartOpsMappingFieldsEditor.tsx` o mesmo bloco condicional que existe no `SmartOpsFormEditor`, **reutilizando** os tipos/helpers já criados em `src/lib/formConditions.ts`:

1. Carregar `conditions` junto com os demais campos no `select` do Supabase.
2. Adicionar `getShowIf(field)` / `setShowIf(field, showIf)` (mesma lógica do FormEditor).
3. Em cada card de campo, abaixo dos controles atuais, renderizar o accordion **"Exibir apenas se…"** com:
   - Toggle ativar/desativar
   - Seletor AND/OR
   - Lista de regras: campo pai (apenas com `order_index` menor + tipo `select`/`radio`/`checkbox`/`text`), operador (`equals`, `not_equals`, `in`, `not_in`, `is_empty`, `is_not_empty`), valor (multi quando pai tem `options`)
   - Botões adicionar/remover regra
4. Badge "Condicional" no header do card quando houver `show_if` ativo.
5. **Importante:** o dropdown de "campo pai" deve listar **tanto campos da Seção C quanto da Seção D** (todos os `smartops_form_fields` do mesmo `form_id` com `order_index` menor), porque um campo de mapeamento pode depender de uma resposta de qualificação (ex.: depende de "Tem impressora 3D?" da Seção C).

## Fora de escopo

- Não mexo no `PublicFormPage` (já funciona).
- Não mexo no `SmartOpsFormEditor` (já tem).
- Sem migration.

## Arquivos afetados

- `src/components/SmartOpsMappingFieldsEditor.tsx` — única alteração.

Confirma que posso implementar?
