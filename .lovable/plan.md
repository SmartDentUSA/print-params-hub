

## Problema

A lista de campos SDR no `SmartOpsWorkflowMapper.tsx` (linha 261-268) é **hardcoded** — uma lista fixa de ~20 campos. Os campos criados nos formulários (`smartops_form_fields`) e seus `db_column` / `custom_field_name` / `workflow_cell_target` não são consultados.

## Correção

**Arquivo: `src/components/smartops/SmartOpsWorkflowMapper.tsx`**

1. No `fetchAll`, adicionar query para buscar campos de formulários:
   ```
   supabase.from("smartops_form_fields").select("id, label, db_column, custom_field_name, workflow_cell_target, form_id")
   ```

2. Substituir `SDR_FIELDS` hardcoded por lista dinâmica que combina:
   - Campos fixos do `lia_attendances` (os ~20 atuais como fallback)
   - **Todos os campos criados nos formulários** (`smartops_form_fields`), usando `db_column` ou `custom_field_name` como valor e `label` como display
   - Deduplicação por valor

3. Na aba SDR, o dropdown de cada célula mostrará os campos com label amigável (ex: "Scanner que possui (formulário SDR)" em vez de "equip_scanner")

4. Na aba Concorrência, para os campos de formulário que têm `options` (radio/select), permitir selecionar os **valores específicos** das opções como itens concorrentes — não apenas o campo

### Detalhes técnicos

- Novo state: `formFields` com os dados de `smartops_form_fields`
- A função `getOptions` para a tab SDR retorna `[...SDR_FIELDS_BASE, ...formFields.map(f => f.db_column || f.custom_field_name)]` filtrado por únicos
- Cada opção no dropdown mostra `label` do formulário quando disponível
- Sem mudança de banco — apenas leitura da tabela existente

