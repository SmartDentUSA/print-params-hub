

# Plano: Reescrever import-proposals-csv — Enrich-Only, Agrupado por Pessoa

## Problema atual

1. Linhas 474-522 criam leads novos com email fake `@import.local` — gerou 223 registros lixo
2. Cascata priorizava `piperun_id` (deal), mas uma pessoa pode ter vários deals
3. Cada deal era processado independente — não agrupava múltiplos deals da mesma pessoa/empresa

## Mudanças

### 1. Migration: deletar os 223 registros lixo

```sql
DELETE FROM lia_attendances WHERE source = 'piperun_proposals_csv';
```

### 2. Reescrever `import-proposals-csv/index.ts`

**A. Agrupar por Pessoa primeiro, depois por Deal:**

O CSV tem múltiplas linhas por proposta/deal. A lógica atual agrupa por `deal_id`. A nova lógica:
1. Agrupa linhas por `deal_id` (mantém — cada deal tem N propostas com N items)
2. **Depois** agrupa deals por `E-mail (Pessoa)` — todos os deals da mesma pessoa viram um array no mesmo lead

**B. Cascata de match (sem nome):**

1. `E-mail (Pessoa)` → match por `email`
2. `Telefone Principal (Pessoa)` → match por `telefone_normalized`
3. `ID (Pessoa)` → match por `pessoa_piperun_id`
4. `ID (Oportunidade)` → match por `piperun_id` (último recurso)

**C. NUNCA cria lead novo** — remover linhas 474-522 completamente. Se nenhum match → `skipped` com detalhes.

**D. Merge de múltiplos deals no mesmo lead:**

Quando uma pessoa tem 3 deals, os 3 snapshots são adicionados ao array `piperun_deals_history` (dedup por `deal_id`). O trigger `fn_recalc_ltv_from_deals` recalcula `ltv_total`, `total_deals`, `anchor_product` automaticamente.

**E. Enriquecimento completo:**
- `pessoa_piperun_id`, `empresa_piperun_id`, `empresa_nome`, `empresa_cnpj`
- `cidade`, `uf`, `especialidade`, `area_atuacao`, `produto_interesse`
- `motivo_perda`, `comentario_perda`, `tem_impressora`, `tem_scanner`
- `proposals_total_value` = soma de todos os deals

### Arquivos

1. **Migration SQL** — DELETE dos 223 lixo
2. **`supabase/functions/import-proposals-csv/index.ts`** — reescrita da lógica de agrupamento e match

### Resultado

| Métrica | Antes | Depois |
|---|---|---|
| Registros lixo | 223 | 0 (nunca mais) |
| Match prioridade 1 | piperun_id | email pessoa |
| Agrupamento | 1 deal = 1 update | N deals mesma pessoa = 1 update |
| Cria leads novos | sim | nunca |
| Skipped com relatório | não | sim (deal_id + email + motivo) |

