## Objetivo
Gerar **um arquivo spreadsheet único** (`produtos-mapeamento-mestre.xlsx`) em `/mnt/documents/` para download — sem criar edge function, sem UI, sem ferramenta no app.

## Fontes de dados
1. **Sistema A (canônico)** — `system_a_catalog` no Supabase (~360 produtos, `category='product'`): `external_id`, `name`, `product_category`, `product_subcategory`, `cta_1_url`, `price`.
2. **Loja Integrada** — API `https://api.awsli.com.br/v1/produto/?limit=100&offset=N` (paginada, ~435 produtos), usando `LOJA_INTEGRADA_API_KEY` + `LOJA_INTEGRADA_APP_KEY` já presentes no projeto.
3. **Workflow 7×3** — taxonomia por `product_category` + fallback `workflow_cell_mappings` (Jaccard ≥ 0.7 por nome normalizado).

## Colunas do XLSX
`nome | sistema_a_id | loja_integrada_id | loja_integrada_sku | loja_integrada_url | piperun_id | sistema_b_id | product_category | product_subcategory | workflow_etapa | workflow_celula | match_source | match_confidence`

- `piperun_id` e `sistema_b_id` ficam **vazios** (preenchimento manual posterior).
- `match_source`: `system_a+loja` | `system_a_only` | `loja_only`.
- Linhas de Loja Integrada sem match em Sistema A são incluídas no final.

## Execução (script local, sem deploy)
1. Script Python em `/tmp/build_master.py`:
   - `psql` → dump `system_a_catalog` (category='product') em CSV.
   - `curl` paginado na Loja Integrada (header `Authorization: chave_api ... aplicacao ...`).
   - Normalização (lowercase, sem acento, sem pontuação) + Jaccard para cross-ref.
   - Aplica taxonomia 7×3 (Scanners→Etapa 1, CAD→Etapa 2, Impressão 3D→Etapa 3, Pós-impressão→Etapa 4, Caracterização→Etapa 5, Cursos→Etapa 6, Fresagem→Etapa 7).
   - Escreve `/mnt/documents/produtos-mapeamento-mestre.xlsx` (openpyxl, header em negrito, freeze panes, autofiltro).
2. QA: abrir o XLSX, validar contagens (Sistema A, Loja Integrada, matched), conferir as 7 etapas distribuídas.
3. Entregar via `<presentation-artifact>`.

## Não inclui
- Nenhum componente React, nenhum edge function, nenhuma alteração de schema.
- Sem chamadas Piperun / Sistema B (colunas em branco como você confirmou).

## Saída final
1 arquivo: `produtos-mapeamento-mestre.xlsx` para download direto.