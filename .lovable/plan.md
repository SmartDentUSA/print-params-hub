
## Plano: Conectar Workflow Portfolio real ao Lead Intelligence Card

### Problema
A edge function `smart-ops-leads-api` retorna `portfolio: null` hardcoded (linha 183), ignorando o campo `workflow_portfolio` que já existe em 944 leads na tabela `lia_attendances`.

### Causa raiz
O DB armazena o portfolio em formato diferente do que o componente `WorkflowPortfolio` espera:

**Formato DB** (`workflow_portfolio`):
```json
{
  "etapa_1_scanner": {
    "ativo_smartdent": ["Medit i700"],
    "mapeamento_concorrente": null,
    "sdr_interesse": null,
    "gap": "completo"
  },
  "summary": { "total_gap_score": 125, ... }
}
```

**Formato Componente** (`Portfolio`):
```json
{
  "etapa_1_scanner": {
    "scanner_intraoral": { "label": "Medit i700", "layer": "ativo", "hits": 1 }
  },
  "summary": { "n_ativo": 2, "n_conc": 0, "n_sdr": 0 }
}
```

### Solução
Editar `supabase/functions/smart-ops-leads-api/index.ts`:

1. **Ler `workflow_portfolio`** do lead já carregado (campo já vem no `select("*")`)
2. **Adicionar função `transformPortfolio()`** que converte o formato DB → formato componente:
   - Para cada etapa, mapear `ativo_smartdent` → subcategorias com `layer: "ativo"`
   - Mapear `mapeamento_concorrente` → `layer: "conc"`
   - Mapear `sdr_interesse` → `layer: "sdr"`
   - Calcular `summary.n_ativo`, `n_conc`, `n_sdr`
3. **Substituir** `portfolio = null` por `portfolio = transformPortfolio(lead.workflow_portfolio)`

### Para leads sem portfolio (25.914 de 26.858)
Manter `portfolio: null` — o componente já exibe fallback "Portfolio não disponível".

### Arquivo editado
- `supabase/functions/smart-ops-leads-api/index.ts`
