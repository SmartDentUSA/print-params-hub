

# Plano: Exportar CSV com TODOS os campos dos leads

## Problema Actual

O `exportCSV` no `SmartOpsReports.tsx` exporta apenas ~12 campos e faz `select("id, nome, email, ...")` com campos hardcoded. A tabela `lia_attendances` tem 200+ colunas.

## Solucao

Modificar o `SmartOpsReports.tsx` para:

1. **Na exportacao CSV** (funcao `exportCSV`), fazer uma query separada com `select("*")` sem o filtro `data_contrato` e sem `.limit(500)` — usar paginacao para buscar todos os leads em batches de 1000 (limite do Supabase).

2. **Gerar CSV dinamicamente**: extrair as keys do primeiro registo como headers, iterar todos os campos de cada lead, serializar JSONB/arrays como JSON string, escapar valores com virgulas/aspas.

3. **Manter a tabela visual e cards inalterados** — apenas a funcao de exportacao muda.

## Detalhes Tecnicos

### Ficheiro: `src/components/SmartOpsReports.tsx`

**Alteracoes na funcao `exportCSV`**:
- Substituir a exportacao actual por uma que faz fetch paginado com `select("*")` em batches de 1000
- Adicionar estado `isExporting` com loading no botao
- Usar todas as keys do primeiro resultado como headers CSV
- Para cada valor: se for objeto/array → `JSON.stringify()`, se for string com virgula/aspas → escapar com aspas duplas
- Download como BOM UTF-8 para compatibilidade Excel
- Nome do ficheiro: `smart-ops-leads-completo-YYYY-MM-DD.csv`

A query de visualizacao (table + cards) permanece igual — so a exportacao muda.

