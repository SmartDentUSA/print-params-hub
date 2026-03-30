

# Plan: Move "Tipo de Entrega" into each proposal item card

## Current behavior
"Tipo de Entrega" (Enviar/Retirar) + Rastreamento appears once at the bottom as a global setting.

## Change
Move delivery type controls **inside each item card**, so every proposal item gets its own Enviar/Retirar toggle and tracking number.

### 1. `src/types/courses.ts` — add per-item delivery fields to `EquipmentEntry`
- Add `tipo_entrega?: 'enviar' | 'retirar'`
- Add `rastreamento?: string`

### 2. `src/components/smartops/EquipmentSerialsSection.tsx`
- **Remove** the global "Tipo de Entrega + Rastreamento" block at the bottom (lines 250-264)
- **Remove** props `tipoEntrega`, `rastreamento`, `onTipoEntregaChange`, `onRastreamentoChange` from the component interface
- **Add** inside each item card (after the serial/date section): Enviar/Retirar toggle buttons + conditional Rastreamento input
- Store per-item via `updateEntry(resolvedKey, { tipo_entrega, rastreamento })`

### 3. `src/components/smartops/EnrollmentModal.tsx`
- Remove the global `tipoEntrega` / `rastreamento` state and the props passed to `EquipmentSerialsSection`
- The per-item delivery data is already stored in `equipmentData[key]`, so no extra state needed

## Result
Each item card will have its own Enviar/Retirar toggle with optional tracking number, allowing different delivery methods per product.

