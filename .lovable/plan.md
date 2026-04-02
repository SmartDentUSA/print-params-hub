

## Corrigir: Regras de Oportunidade sem campos de formulário

### Problema

No `renderRulesTable()` (linha 313-316), o dropdown "Item Detectado" do `NewRuleForm` só recebe:
- `stageCompetitors` (mapeamentos tipo "competitor")
- `stageProducts` (mapeamentos tipo "product")

Faltam: campos de formulário e suas opções (radio/select/checkbox).

### Correção

**Arquivo: `src/components/smartops/SmartOpsWorkflowMapper.tsx`**

1. No `renderRulesTable()`, expandir `allSourceItems` (linha 316) para incluir:
   - Opções dos campos de formulário com tipo radio/select/checkbox (mesma lógica do `formFieldOptions` já existente na linha 303-305)
   - Labels dos campos SDR dinâmicos (para identificar campos de texto como "Scanner que possui")

2. Atualizar a construção de `allSourceItems`:
```
const formOpts = formFields
  .filter(f => ["radio","select","checkbox"].includes(f.field_type||"") && Array.isArray(f.options))
  .flatMap(f => (f.options as string[]));
const sdrFieldLabels = allSDRFieldEntries.map(e => e.label);
const allSourceItems = [...new Set([...stageCompetitors, ...stageProducts, ...formOpts, ...sdrFieldLabels])];
```

3. No `NewRuleForm`, permitir também digitação livre (fallback Input) além do dropdown, para itens não pré-cadastrados — adicionar opção "Outro (digitar)" no select.

### Resultado
- Dropdown "Item Detectado" nas regras mostra: concorrentes mapeados + produtos + todas as opções de formulários + campos SDR
- Permite criar regras baseadas em qualquer resposta de formulário

