

## Fix: Adicionar `field_label` no insert de respostas do formulário

### Problema
Na linha 248-254, o insert em `smartops_form_field_responses` não inclui `field_label`. Embora exista trigger no banco, é melhor passar explicitamente para evitar dependência do trigger e garantir dados corretos.

### Correção

**Arquivo: `src/pages/PublicFormPage.tsx` — linha 248-254**

Adicionar `field_label: f.label` ao objeto de resposta:

```typescript
return {
  form_id: form.id,
  field_id: f.id,
  lead_id: leadId,
  value,
  workflow_cell_target: f.workflow_cell_target,
  field_label: f.label,
};
```

### Chamada ao `smart-ops-deal-form-note`
Já confirmado: linhas 278-280 mostram que `smart-ops-deal-form-note` é invocado com `lead_id` e `form_name` (fire-and-forget) após salvar as respostas. Nenhuma mudança necessária nesta parte.

### Escopo
- 1 linha adicionada em 1 arquivo
- Sem breaking changes

