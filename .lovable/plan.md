

## Plano: Adicionar campo tipo Slider de valores ao Form Builder

### O que será feito

Novo tipo de campo **"slider"** nos formulários, com 3 valores configuráveis pelo admin: **inicial**, **médio** e **final**. O lead arrasta o slider e o valor numérico selecionado é salvo.

### Mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/SmartOpsFormEditor.tsx` | Adicionar `{ value: "slider", label: "Slider de valores" }` em `FIELD_TYPES`. Quando `field_type === "slider"`, exibir 3 inputs para configurar `min`, `mid`, `max` (salvos em `options: { min, mid, max }`) |
| `src/pages/PublicFormPage.tsx` | Renderizar `<Slider>` (Radix) para `field_type === "slider"` com `min`/`max` do options, exibindo o valor atual e marcadores visuais para inicial/médio/final |

### Detalhes técnicos

**Editor (admin):**
- 3 campos numéricos: "Valor inicial", "Valor médio", "Valor final"
- Salvos como `options: { min: 0, mid: 50, max: 100 }` (JSONB)

**Formulário público (lead):**
- Componente `<Slider>` do Radix com `min`/`max`
- Labels abaixo mostrando os 3 valores de referência
- Valor default = `mid`
- Exibe valor selecionado em tempo real

