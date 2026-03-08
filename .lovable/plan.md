

# Mover "Calculadoras ROI" para dentro de "Gerenciar Base de Conhecimento"

## Problema
A aba "Calculadoras ROI" está atualmente dentro de **Conteúdo (SmartOpsContentProduction)**. O usuário quer que ela fique dentro de **Gerenciar Base de Conhecimento (AdminKnowledge)**, como uma aba ao lado das categorias A–E e do Validador.

## Alterações

### 1. `src/components/AdminKnowledge.tsx`
- Importar `SmartOpsROICalculators`
- Adicionar nova `TabsTrigger` com valor `"roi-calculators"` e label **"F • Calculadora de ROI"** ao lado do Validador
- Adicionar `TabsContent` correspondente renderizando `<SmartOpsROICalculators />`
- Ajustar grid de `grid-cols-6` para `grid-cols-8` para acomodar a nova aba

### 2. `src/components/SmartOpsContentProduction.tsx`
- Remover a aba "Calculadoras ROI" e o import de `SmartOpsROICalculators`
- Remover o wrapper `Tabs` que envolvia Produção + ROI, deixando apenas o conteúdo de Produção direto

## Resultado
- Aba "F • Calculadora de ROI" visível em **Gerenciar Base de Conhecimento**, entre as categorias existentes e o Validador
- Aba Conteúdo do Smart Ops volta a ter apenas a lista de Produção

