## Diagnóstico

Hoje os cards 7×3 dos leads são montados em `supabase/functions/smart-ops-leads-api/index.ts` pela função `transformPortfolioFromLead`, que usa um mapa hardcoded `LEAD_COLUMN_MAP` (linhas 269-301). Esse mapa cobre apenas heurísticas grosseiras:

- Só preenche `scanner_intraoral`, `impressora`, `equipamentos`, `caracterizacao`, etc. — ignora `scanner_bancada`, `notebook`, `software_impressao`, `instalacao`, `dentistica_orto`, `online`, `insumos`, `limpeza_acabamento`, `credito_ia`.
- A camada `ativo` depende de `hits_scanner/hits_impressao3d/...` que vêm de `fn_classify_deal_category`, classificador por keyword (`ILIKE %scanner%`, `%medit%`, etc.). Não consulta `workflow_cell_mappings`, então as 223 regras curadas (incluindo a recente reclassificação de Bio Clear Guide → resina, Medit i500 → competitor, etc.) não chegam ao card.
- Resultado: leads que compraram resinas Bio Clear Guide, kits de caracterização, software de impressão, cursos online, fresadoras, etc. aparecem com células vazias ou na coluna errada.

## Objetivo

Tornar `workflow_cell_mappings` a fonte de verdade para as 3 camadas (ativo / conc / sdr) do card 7×3 de cada lead.

## Mudanças

### 1. Nova RPC `compute_lead_portfolio_from_mappings(p_lead_id uuid) returns jsonb`

Constrói o portfolio cruzando dados do lead com `workflow_cell_mappings`:

- **Ativo** (`mapping_type='product'`): join `deal_items` (apenas deals `status='ganha'` da Smart Dent) com `workflow_cell_mappings` via normalização case-insensitive do nome do item × `mapped_label` ou `mapped_value`. Agrupa por `(workflow_stage, workflow_cell)`, soma `hits`, usa o `mapped_label` mais frequente como `label`.
- **Concorrente** (`mapping_type='competitor'`): match dos campos `equip_scanner`, `equip_impressora`, `equip_pos_impressao`, `equip_fresadora`, `equip_cad`, `software_cad` do `lia_attendances` contra `mapped_label/mapped_value` da camada `competitor`. Quando bater, ocupa a célula como `conc` (somente se a célula não estiver `ativo`).
- **SDR** (`mapping_type='sdr_field'`): match dos campos `sdr_scanner_interesse`, `sdr_impressora_interesse`, `sdr_pos_impressao_interesse`, `sdr_caracterizacao_interesse`, `sdr_dentistica_interesse`, `sdr_cursos_interesse`, `sdr_fresagem_interesse`, `sdr_cad_interesse`, `resina_interesse` contra `mapped_value` da camada `sdr_field`. Ocupa a célula como `sdr` (somente se não estiver `ativo` nem `conc`).

Saída no formato consumido por `WorkflowPortfolio.tsx`:
```json
{
  "etapa_3_impressao": {
    "resina":     { "label": "Bio Clear Guide", "layer": "ativo", "hits": 4 },
    "impressora": { "label": "Anycubic Mono X", "layer": "conc",  "hits": 1 }
  },
  "summary": { "n_ativo": 5, "n_conc": 2, "n_sdr": 1, "n_mapeamento": 0 }
}
```

### 2. `smart-ops-leads-api/index.ts`

Em `getLeadFullCard` (linha ~222), antes do fallback `transformPortfolioFromLead`:

```ts
const { data: portfolioFromMappings } = await supabase
  .rpc('compute_lead_portfolio_from_mappings', { p_lead_id: lead.id });

const portfolio = (portfolioFromMappings && Object.keys(portfolioFromMappings).length > 1)
  ? portfolioFromMappings
  : transformPortfolioFromLead(lead, taxonomyMap);
```

Mantém o fallback heurístico para leads antigos sem deal_items resolvidos.

### 3. Nenhuma alteração visual

`WorkflowPortfolio.tsx` continua igual — só passa a receber dados corretos.

## Fora do escopo

- Não toca em `fn_classify_deal_category` nem nos campos `hits_*`/`equip_*` (usados por outros relatórios — RFM, brand distribution, intelligence score).
- Não cria trigger de recomputação — o cálculo é on-demand via RPC quando o card é aberto.
- Não altera UI do `SmartOpsWorkflowMapper`.

## Validação

Após implementar, consultar 3 leads representativos:
1. Um com deal ganho de resina Bio Clear Guide → célula `etapa_3_impressao/resina` em `ativo`.
2. Um com `equip_scanner='Medit i500'` → célula `scanner_intraoral` em `conc`.
3. Um com `sdr_fresagem_interesse='sim'` → célula `etapa_7_fresagem/equipamentos` em `sdr`.