

## Nova Aba "Mapeamento 7×3" — Motor de Regras Dinâmico com Integração LIA/Copilot

### Resumo

Criar aba no SmartOps com interface visual para configurar mapeamentos e regras de oportunidade nas 7 etapas do workflow. Sem campo "Valor Estimado". Todas as regras ficam acessíveis para LIA, Copilot e análise cognitiva.

### Banco de Dados — 2 tabelas novas

```sql
-- Mapeamentos: vincula campos/produtos/concorrentes às células do workflow
CREATE TABLE workflow_cell_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_stage text NOT NULL,       -- 'etapa_1_scanner'
  workflow_cell text NOT NULL,        -- 'scanner_intraoral'
  mapping_type text NOT NULL,         -- 'sdr_field' | 'product' | 'competitor'
  mapped_value text NOT NULL,         -- campo do banco, produto, ou valor concorrente
  mapped_label text,                  -- label para exibição
  created_at timestamptz DEFAULT now(),
  UNIQUE(workflow_stage, workflow_cell, mapping_type, mapped_value)
);

-- Regras de oportunidade por item detectado
CREATE TABLE opportunity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_stage text NOT NULL,
  workflow_cell text NOT NULL,
  source_item text NOT NULL,          -- ex: 'Medit i500', 'iTero 5D'
  action_type text NOT NULL,          -- upgrade | migration | cross_sell | upsell | recompra | complemento | upsell_edu
  target_product_name text,           -- produto SmartDent recomendado
  useful_life_months int DEFAULT 12,  -- tempo útil antes de gerar oportunidade
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- SEM campo value_est_brl
```

RLS: acesso público de leitura (mesma política das outras tabelas operacionais).

### Frontend — Novo componente

**`src/components/smartops/SmartOpsWorkflowMapper.tsx`**

4 seções verticais:

**Seção 1 — SDR / Interesse**
- Grade 7 etapas × subcategorias (reutilizando STAGES do WorkflowPortfolio)
- Cada célula: multi-select com campos existentes de `lia_attendances` + campos customizados de formulários

**Seção 2 — Produtos SmartDent**
- Mesma grade, cada célula: multi-select com produtos de `system_a_catalog` (ativos)

**Seção 3 — Concorrência**
- Mesma grade, cada célula: multi-select com valores livres (itens concorrentes como os scanners listados)

**Seção 4 — Quadro de Regras**
- Tabela editável agrupada por etapa
- Colunas: Item Detectado | Tipo Ação (dropdown) | Produto do Mix (dropdown de produtos SmartDent da etapa) | Tempo Útil (meses)
- Botão "+ Adicionar Regra" por etapa

**`SmartOpsTab.tsx`** — Adicionar aba "Mapeamento 7×3" com trigger e content.

### Integração com LIA, Copilot e Análise Cognitiva

**1. Copilot (`smart-ops-copilot/index.ts`)**
- Nova tool `query_opportunity_rules`: consulta `opportunity_rules` e `workflow_cell_mappings` com filtros por stage, tipo, item
- Adicionada ao system prompt: "Use query_opportunity_rules para entender o portfólio de produtos por etapa, regras de upgrade/migration, e tempos úteis de equipamentos"
- O Copilot poderá responder: "Quais leads têm iTero e qual a ação recomendada?"

**2. LIA SDR (`_shared/lia-sdr.ts`)**
- Ao montar contexto comercial, consultar `opportunity_rules` para enriquecer a abordagem com base nos equipamentos detectados do lead
- Ex: lead tem "3Shape Omnicam" → regra diz migration → Medit i700W → LIA sugere essa abordagem

**3. Análise Cognitiva (`cognitive-lead-analysis/index.ts`)**
- Incluir no prompt do DeepSeek as regras aplicáveis ao lead (cruzando portfolio_json + opportunity_rules)
- A análise cognitiva passa a considerar: "Lead tem equipamento X há Y meses, tempo útil é Z meses → oportunidade de upgrade iminente"

**4. `fn_get_lead_context`** (DB function)
- Expandir para incluir: `oportunidades_mapeadas` (regras que se aplicam ao lead baseado no portfolio_json)

### Arquivos modificados/criados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar `workflow_cell_mappings` + `opportunity_rules` |
| `src/components/smartops/SmartOpsWorkflowMapper.tsx` | Novo — interface completa |
| `src/components/SmartOpsTab.tsx` | Adicionar aba |
| `supabase/functions/smart-ops-copilot/index.ts` | Nova tool `query_opportunity_rules` |
| `supabase/functions/cognitive-lead-analysis/index.ts` | Injetar regras no prompt |
| `supabase/functions/_shared/lia-sdr.ts` | Consultar regras para abordagem |
| Migration SQL | Atualizar `fn_get_lead_context` |

### Resultado

- Regras configuráveis pela equipe sem deploy
- LIA usa as regras para personalizar abordagem comercial
- Copilot consulta regras para análise e campanhas
- Análise cognitiva considera tempo útil de equipamentos para predição
- Zero hardcode — tudo vem do banco

