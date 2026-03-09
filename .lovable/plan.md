

# Smart Flow Analytics — Reestruturação com Banco de Dados

## Resumo
Migrar a calculadora de ROI de valores hardcoded para um sistema dinâmico baseado em Supabase, com CRUD admin e galeria de seleção de cards.

## 1. Migration: Tabela `roi_cards`

Criar tabela com todos os campos de performance, custo, delegacao e financeiro. RLS: leitura publica para cards publicados, escrita restrita a admins via `is_admin()`.

```sql
CREATE TABLE roi_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'combo',
  image_url TEXT,
  -- Tempos por etapa
  scan_time_manual NUMERIC DEFAULT 15,
  scan_time_smart NUMERIC DEFAULT 5,
  cad_time_manual NUMERIC DEFAULT 20,
  cad_time_smart NUMERIC DEFAULT 4,
  cad_cost_manual NUMERIC DEFAULT 50,
  cad_cost_smart NUMERIC DEFAULT 8,
  print_time_manual NUMERIC DEFAULT 15,
  print_time_smart NUMERIC DEFAULT 0.5,
  clean_time_manual NUMERIC DEFAULT 10,
  clean_time_smart NUMERIC DEFAULT 0.67,
  cure_time_manual NUMERIC DEFAULT 15,
  cure_time_smart NUMERIC DEFAULT 5,
  finish_time_manual NUMERIC DEFAULT 30,
  finish_time_smart NUMERIC DEFAULT 9,
  -- Desperdicio
  waste_pct_manual NUMERIC DEFAULT 20,
  waste_pct_smart NUMERIC DEFAULT 0,
  -- ASB flags
  asb_scan BOOLEAN DEFAULT true,
  asb_cad BOOLEAN DEFAULT false,
  asb_print BOOLEAN DEFAULT true,
  asb_clean BOOLEAN DEFAULT true,
  asb_cure BOOLEAN DEFAULT true,
  asb_finish BOOLEAN DEFAULT true,
  -- Financeiro
  preco_mercado NUMERIC,
  preco_combo NUMERIC,
  rendimento_unidades INTEGER,
  investimento_inicial NUMERIC DEFAULT 77900,
  faturamento_kit NUMERIC DEFAULT 128524.82,
  -- Meta
  status TEXT DEFAULT 'rascunho',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roi_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published roi_cards"
  ON roi_cards FOR SELECT
  USING (status = 'publicado' AND active = true);

CREATE POLICY "Admins can manage roi_cards"
  ON roi_cards FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));
```

## 2. New Component: `SmartOpsROICardsManager.tsx`

Admin CRUD interface within the ROI tab (toggled via a "Gerenciar Cards" button visible to admins). Features:
- Table listing all cards with name, category, status
- Modal form for create/edit with all fields grouped: Identity, Tempos (6 stages x 2), ASB checkboxes, Financeiro
- Image upload to `catalog-images` bucket
- Status toggle (rascunho/publicado)
- Delete with confirmation
- Uses `useQuery` + `useMutation` pattern with `@tanstack/react-query`

## 3. Refactor: `SmartOpsSmartFlowAnalytics.tsx`

**Remove**: `const WORKFLOW_STAGES`, `INVESTIMENTO_INICIAL`, `FATURAMENTO_KIT`, `LUCRO_KIT` hardcoded constants.

**Add**:
- `useQuery` to fetch published `roi_cards`
- `selectedCardId` state
- **Gallery grid** at the top showing card images/names from DB
- Click to select -> highlights card
- `workflowStages` via `useMemo` mapping `selectedCard` fields to the `WorkflowStage[]` interface
- All calculations (`calculos`, `chartData`) now use `selectedCard.investimento_inicial` and `selectedCard.faturamento_kit`
- Show "Selecione um equipamento" placeholder when no card selected
- Keep DEFAULT_STAGES as fallback if no card selected

**Keep unchanged**: Sliders, Lead Gate modal, stage cards UI, dashboard cards, chart structure.

## 4. Integration in `SmartOpsTab.tsx`

No changes needed -- ROI tab already renders `<SmartOpsSmartFlowAnalytics />`. The admin toggle will be internal to the component.

## Files

| File | Action |
|------|--------|
| Supabase migration | Create `roi_cards` table + RLS |
| `src/components/SmartOpsROICardsManager.tsx` | **New** -- Admin CRUD |
| `src/components/SmartOpsSmartFlowAnalytics.tsx` | **Refactor** -- Dynamic data from DB |

