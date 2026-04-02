

## Corrigir: Aba "Mapeamento 7×3" não aparece no Admin

### Problema

O admin usa `AdminViewSecure.tsx` com renderização direta por `activeSection` (não usa `SmartOpsTab.tsx`). O componente `SmartOpsWorkflowMapper` foi criado e adicionado ao `SmartOpsTab.tsx`, mas:

1. **`AdminSidebar.tsx`** — falta o item `so-mapeamento` na lista de Smart Ops
2. **`AdminViewSecure.tsx`** — falta o import e o case `so-mapeamento` no switch

### Correções

**1. `src/components/AdminSidebar.tsx`**
- Adicionar `{ id: "so-mapeamento", title: "Mapeamento 7×3", icon: Grid3X3 }` (ou `Map`) na lista de items do grupo Smart Ops, antes de `so-copilot`
- Importar o ícone adequado (ex: `Map` do lucide-react)

**2. `src/pages/AdminViewSecure.tsx`**
- Adicionar import: `import { SmartOpsWorkflowMapper } from "@/components/smartops/SmartOpsWorkflowMapper";`
- Adicionar case no switch: `case 'so-mapeamento': return <SmartOpsWorkflowMapper />;`

### Resultado
A aba aparecerá na sidebar do Smart Ops e renderizará o componente ao clicar.

