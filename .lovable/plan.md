

# Plan: Add Proposals Table + Product Mix Intelligence (ADDITIVE only)

## Context

The user wants TWO new sections **added** to the Lead Card (no existing sections removed/changed):

1. **Tabela de Propostas** — flat table with: Data, Proposta (sigla), Funil, Itens (summary), Valor, Frete, Pgto, Vendedor
2. **Product Mix Intelligence** — aggregated table with: Cod, Produto, Deals, Qtd Total, Receita, % Mix, Tendencia

Also a qty bug fix: the sync stores `item.qtd` but the UI reads `item.quantidade || item.quantity`, always showing 1x.

## Data already available in `piperun_deals_history`

The sync (`smart-ops-sync-piperun`) already stores rich proposal data per deal:
- `proposals[].sigla` (PRO3067, etc.)
- `proposals[].vendedor`
- `proposals[].tipo_frete`, `proposals[].valor_frete`
- `proposals[].parcelas` (number of installments)
- `proposals[].valor_ps` (total proposal value)
- `proposals[].items[].nome`, `.qtd`, `.unit`, `.total`, `.item_id`, `.categoria`

No backend changes needed. All data is already in the JSONB.

## Changes (LeadDetailPanel.tsx only)

### 1. Fix qty bug (lines 453, 560, 740)

Add `item.qtd` as first fallback in all three places:
```
const qty = Number(item.qtd || item.quantidade || item.quantity || 1);
```

### 2. Add "Tabela de Propostas" section (after Deals PipeRun table, before Produtos Mais Vendidos)

Build a flat array of all proposals from all deals with columns:

| Data | Proposta | Funil | Itens | Valor | Frete | Pgto | Vendedor |
|------|----------|-------|-------|-------|-------|------|----------|

- **Data**: `d.created_at` formatted
- **Proposta**: `prop.sigla || prop.id`
- **Funil**: `d.pipeline_name`
- **Itens**: summary like "1x Try-In Calcinavel 250g (R$440)"
- **Valor**: `prop.valor_ps`
- **Frete**: `prop.valor_frete` + `prop.tipo_frete` (e.g. "R$72 FOB")
- **Pgto**: `prop.parcelas` (e.g. "1x Boleto" or "12x")
- **Vendedor**: `prop.vendedor`

Status chip colored by deal status (Ganho/Perdido/Aberto).

### 3. Add "Product Mix Intelligence" section (after Produtos Mais Vendidos)

Aggregate ALL deals (not just won) by product name. Columns:

| Cod | Produto | Deals | Qtd Total | Receita | % Mix | Tendencia |
|-----|---------|-------|-----------|---------|-------|-----------|

Logic:
- Group items by `item.nome` (normalized)
- **Cod**: `item.item_id` (PipeRun internal ID, best available)
- **Deals**: count distinct `deal_id` where product appears
- **Qtd Total**: sum of `item.qtd` across all deals
- **Receita**: sum of `item.total`
- **% Mix**: `receita_produto / total_receita_all_items * 100`
- **Tendencia**: calculated from temporal pattern:
  - 1 occurrence → "— Uma vez"
  - 2+ with same product, increasing frequency → "↑ Crescendo"
  - 2+ stable → "→ Recorrente"
  - Only from won deals

### Summary

- **Files changed**: 1 (`src/components/smartops/LeadDetailPanel.tsx`)
- **Backend changes**: None (data already in JSONB)
- **Nothing removed**: All existing sections preserved as-is

