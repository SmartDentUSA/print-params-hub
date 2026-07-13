## Objetivo
Na tabela do dashboard **Smart Ops › Stripe Payments** (`src/components/SmartOpsStripePayments.tsx`):

1. A coluna atual **"ID Smart Dent"** (que hoje mostra os 8 primeiros dígitos de `lead_id`) passa a se chamar **"ID Sistema"** — comportamento inalterado (clique copia o UUID completo).
2. Criar uma nova coluna **"ID Smart Dent"** — campo de texto editável preenchido pelo usuário, persistido em `stripe_payment_units.id_smartdent`.

## Alterações

### 1. Migration
Adicionar coluna em `stripe_payment_units`:
```sql
ALTER TABLE public.stripe_payment_units
  ADD COLUMN IF NOT EXISTS id_smartdent TEXT NULL;
```

### 2. `SmartOpsStripePayments.tsx`
- **Interfaces `Unit` e `Row`:** adicionar `id_smartdent: string | null`.
- **Select do fetch de `stripe_payment_units`:** incluir `id_smartdent`.
- **Montagem do `Row`:** propagar `id_smartdent: u.id_smartdent ?? null`.
- **Header (linha 571):** renomear `"ID Smart Dent"` → `"ID Sistema"` e adicionar nova `<th>ID Smart Dent</th>` logo após.
- **Body:** manter a célula atual (com `r.lead_id`) sob "ID Sistema"; adicionar nova célula (uma por unidade, não `rowSpan`) com `<input type="text" defaultValue={r.id_smartdent ?? ""} onBlur={...} />` chamando `updateUnit(r.unit_id, { id_smartdent: v || null })`.

## Fora de escopo
- Sem mudanças em KPIs, webhooks, Ativações ou lógica de mensalidades.
- Sem validação de formato do ID Smart Dent (texto livre).
