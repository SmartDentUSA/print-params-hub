

# Plan: Fix proposal items not appearing for serial/date entry in enrollment

## Problem

When scheduling an enrollment, proposal items from "won" deals either:
1. Don't appear at all (empty `proposals` array in the deal snapshot)
2. Appear under "Insumos e serviços" as read-only text without serial number, activation date, or delivery type inputs — because `inferCategory()` returns `'outro'` and `categoryToEquipKey('outro')` returns `null`

Currently, only items matching specific regex patterns (scanner, notebook, CAD, impressora, etc.) get the equipment card UI with serial/date inputs. Everything else is shown as plain text.

## Root cause

**`src/lib/courseUtils.ts` — `inferCategory()` function** has limited regex patterns. Products with names like "Resina 3D", "Kit de Calibração", "Forno", "Articulador" etc. all fall into `'outro'` → `equip_key: null` → no serial inputs.

**`src/components/smartops/EquipmentSerialsSection.tsx`** only renders serial/date inputs for items where `equip_key !== null`.

## Fix (2 files)

### 1. `src/components/smartops/EquipmentSerialsSection.tsx`
- Add serial number and activation date inputs for ALL items (including those with `equip_key === null`)
- The "Insumos e serviços" section currently shows plain text — change it to show expandable cards with optional serial, activation date fields
- Add a generic `equip_key` override: let the user manually assign an equipment category via a dropdown if the auto-detection was wrong
- Keep the "Tipo de Entrega" (enviar/retirar) and "Rastreamento" at the bottom as-is

### 2. `src/types/courses.ts`
- Add a catch-all `equip_outro` key to `EquipKey` type so uncategorized items can still carry serial/date data
- Update `EquipmentData` accordingly

### 3. `src/lib/courseUtils.ts`
- Add `equip_outro` to `EQUIP_CONFIG` with generic labels
- Update `categoryToEquipKey` to return `'equip_outro'` instead of `null` for unmatched items
- Expand `inferCategory` regex to catch more common product names (forno, articulador, compressor, autoclave, fotopolimerizador, kit)

## Result

Every proposal item — regardless of category — will display as an interactive card with:
- Product name + quantity + value (existing)
- Serial number input
- Activation date input
- Equipment category badge (auto-detected or manually overridden)

