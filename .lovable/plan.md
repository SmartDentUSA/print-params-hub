

## Plano: Redesenhar Funil Estagnados com Etapas Reais do Piperun

### Diagnostico

A planilha exportada do Piperun contem **~907 leads** no "Funil Estagnados" com **5 etapas reais**:

```text
Etapa 01 - Reativacao  (maioria dos leads, os mais recentes)
Etapa 02 - Reativacao  (lead-timing ~7-8 dias)
Etapa 03 - Reativacao  (lead-timing ~1-2 dias)
Etapa 04 - Reativacao  (lead-timing ~14-15 dias)
Proposta Enviada - Estag (lead-timing ~16 dias)
```

O Kanban atual usa **3 funis x 6 etapas = 18 etapas ficticias** (`est1_0` a `est3_5`) que NAO correspondem ao Piperun real. Alem disso, existem **24 leads demo** com emails `@demo.com` poluindo o banco.

### Acoes

**Frente 1 — Redesenhar Funil Estagnados no Kanban**

Arquivo: `src/components/SmartOpsKanban.tsx`

Substituir os 3 `STAGNANT_FUNNELS` (18 etapas) por um unico funil com 5 etapas reais:

```text
ANTES (18 etapas ficticias):
  est1_0, est1_1, ..., est1_5
  est2_0, est2_1, ..., est2_5
  est3_0, est3_1, ..., est3_5

DEPOIS (5 etapas reais do Piperun):
  est_etapa1  → "Etapa 01 - Reativacao"
  est_etapa2  → "Etapa 02 - Reativacao"
  est_etapa3  → "Etapa 03 - Reativacao"
  est_etapa4  → "Etapa 04 - Reativacao"
  est_proposta → "Proposta Enviada"
  estagnado_final (manter)
```

Mudancas:
- Remover `STAGNANT_FUNNELS` array e `FUNNEL_COLORS`
- Criar `STAGNANT_COLUMNS` com as 5 etapas reais
- Atualizar `STATUS_KEYS` e `ALL_STAGNANT_KEYS`
- Simplificar o render para um unico bloco horizontal (sem 3 secoes separadas)

**Frente 2 — Atualizar Stagnant Processor Edge Function**

Arquivo: `supabase/functions/smart-ops-stagnant-processor/index.ts`

Atualizar a cadeia de progressao:

```text
ANTES: est1_0 → est1_1 → ... → est1_5 → est2_0 → ... → est3_5 → estagnado_final
DEPOIS: est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_proposta → estagnado_final
```

**Frente 3 — Limpar Dados Demo**

Deletar os 24 leads demo (`@demo.com`) do banco.

**Frente 4 — Importar Leads Reais**

Inserir os ~907 leads da planilha no `lia_attendances` com:
- `lead_status` mapeado: "Etapa 01" → `est_etapa1`, "Etapa 02" → `est_etapa2`, etc.
- `nome`: extraido do campo "Titulo" (nome do lead)
- `email`: campo "E-mail (Pessoa)"
- `telefone_normalized`: campo "Telefone (Pessoa)"
- `produto_interesse`: campo "Produto de interesse"
- `proprietario_lead_crm`: campo "Nome do dono da oportunidade"
- `area_atuacao`: campo "Area de Atuacao"
- `piperun_id`: campo "ID"
- `piperun_link`: campo "Link"
- `lead_timing_dias`: campo "Lead-Timing"
- `funil_entrada_crm`: "Funil Estagnados"
- `source`: "piperun"

A importacao sera feita via edge function `import-leads-csv` em batches.

### Resumo

```text
MODIFICAR:
  src/components/SmartOpsKanban.tsx
    - Substituir 3 funis x 6 etapas por 1 funil x 5 etapas reais
    - Atualizar STATUS_KEYS, render simplificado

  supabase/functions/smart-ops-stagnant-processor/index.ts
    - Nova cadeia: est_etapa1 → est_etapa2 → ... → estagnado_final

DATA OPS:
  DELETE leads demo (@demo.com)
  INSERT ~907 leads reais da planilha Piperun
```

