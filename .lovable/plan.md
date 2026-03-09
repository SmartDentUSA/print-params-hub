

# Adicionar Seção "Apresentações (SKUs)" ao Card de Resinas

## Objetivo
Inserir uma seção dinâmica entre "Documentos Técnicos" (linha 2267) e o switch "Ativo" (linha 2269) no `AdminModal.tsx`, com os campos exatos solicitados.

## 1. Nova Tabela `resin_presentations` (Migration)

```sql
CREATE TABLE resin_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resin_id UUID NOT NULL REFERENCES resins(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  price NUMERIC DEFAULT 0,
  price_per_gram NUMERIC DEFAULT 0,
  print_type TEXT DEFAULT '',
  grams_per_print NUMERIC DEFAULT 0,
  prints_per_bottle INTEGER DEFAULT 0,
  cost_per_print NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE resin_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read resin_presentations"
  ON resin_presentations FOR SELECT USING (true);

CREATE POLICY "Admins can manage resin_presentations"
  ON resin_presentations FOR ALL TO authenticated
  USING (is_admin(auth.uid()));
```

**Columns map to user's headers:**
- `label` → Apresentação (grs)
- `price` → Preço normal
- `price_per_gram` → Preço por grama
- `print_type` → Tipo de impressão
- `grams_per_print` → Gramas por impressão
- `prints_per_bottle` → Impressões por frasco
- `cost_per_print` → Custo por impressão

## 2. UI no AdminModal.tsx

Insert between line 2267 and 2269 a new section "📦 Apresentações (SKUs)":

- State: `presentations` array, fetched on modal open when `type === 'resin'` and item exists
- Each row renders 7 inline inputs in a responsive grid + trash button
- "+ Adicionar Apresentação" button inserts a new row (INSERT into DB immediately)
- Field changes trigger debounced UPDATE
- Delete removes from DB and state

The section will use a table-like grid layout with headers matching the exact column names requested.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| Supabase Migration | Criar tabela `resin_presentations` + RLS |
| `src/components/AdminModal.tsx` | Adicionar state `presentations`, fetch on open, CRUD inline section abaixo de Documentos Técnicos |

