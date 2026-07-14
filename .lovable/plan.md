
## Objetivo

No dashboard **Impressora 3D Rayshape Edge Mini — Donos**:

1. Redefinir a regra de `sale_kind`:
   - **combo** = a proposta ganha que contém a Edge Mini também contém um **scanner intraoral** (item na mesma proposta cujo nome bate com padrão de scanner intraoral).
   - **separado** = caso contrário.
2. Adicionar 2 novos KPIs ao painel:
   - **Recompra Combo (R$)** — soma de todos os pedidos (ganhos) do dono, com data posterior à data da compra do combo Edge Mini.
   - **Recompra Separado (R$)** — soma de todos os pedidos (ganhos) do dono, com data posterior à data da compra separada da Edge Mini.

## Regra "combo = tem scanner intraoral"

Considera scanner intraoral qualquer item da mesma proposta cujo nome contenha (case-insensitive):

```
(scanner\s*intraoral|intraoral|medit|itero|trios|primescan|aoralscan|shining|helios|panda\s*p|runyes|launca|freedom|carestream\s*cs\s*3|3shape|emerald)
```

- Fica de fora scanners de bancada / desktop (Ceramill, Straumann DWOS, D2000 etc.). Se aparecer algum caso de borda a gente ajusta o regex depois.
- A detecção continua a nível de **proposta** (`prop->'items'`): a proposta precisa ter (a) item Edge Mini e (b) item scanner intraoral.
- Agregação por lead via `BOOL_OR` como hoje: se qualquer deal ganho do dono for combo, o dono é combo.

## Recompra (data da compra Edge Mini)

Para cada dono:

- `edge_purchase_at` = data (`won_at` / `created_at`) da 1ª proposta ganha que contém a Edge Mini.
- `recompra_valor` = soma dos `deals.value` (ou `proposal.total`) de deals **ganhos** do mesmo lead com `won_at > edge_purchase_at`.
- Divide em dois campos no retorno da RPC:
  - `recompra_combo_brl` se `sale_kind='combo'`.
  - `recompra_separado_brl` se `sale_kind='separado'`.

No painel, os 2 KPIs somam esses campos entre todos os donos.

## Mudanças

### 1. Migration — `fn_rayshape_owners()`

- Ajustar `is_combo` da CTE de proposals para exigir presença de scanner intraoral na mesma proposta (regex acima) além do item Edge Mini.
- Calcular `edge_purchase_at` (min `won_at` da proposta que tem Edge Mini).
- LEFT JOIN em `deals` ganhos do mesmo `lead_id` com `won_at > edge_purchase_at` e somar `value` → `recompra_brl`.
- Retornar novas colunas: `edge_purchase_at timestamptz`, `recompra_combo_brl numeric`, `recompra_separado_brl numeric`.

### 2. Frontend — `src/components/SmartOpsRayshape.tsx`

- Estender `Owner` com `edge_purchase_at`, `recompra_combo_brl`, `recompra_separado_brl`.
- Em `useMemo(kpis)`, somar:
  - `recompraCombo = Σ recompra_combo_brl`
  - `recompraSeparado = Σ recompra_separado_brl`
- Adicionar 2 cards de KPI (grid expande de 6 → 8) formatando em BRL.
- Sem alteração nos filtros/badges já existentes.

## Fora de escopo

- Não muda thresholds nem lista de donos.
- Não inclui deals `is_deleted=true`.
- Não altera `fn_rayshape_status`.

## Verificação

- Rodar `SELECT sale_kind, count(*), sum(recompra_combo_brl), sum(recompra_separado_brl) FROM fn_rayshape_owners() GROUP BY 1` para conferir totais.
- Amostrar 3 donos combo e 3 separado, conferindo `edge_purchase_at` e os deals ganhos posteriores.
