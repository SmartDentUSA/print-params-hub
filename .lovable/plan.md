

## Plano: Jornada das Siglas — Adicionar PQL e Refinar Classificação Cognitiva

### Contexto Atual (dados reais)

| Campo | Valores em uso |
|---|---|
| `lead_stage_detected` | `NULL` (24.559), `MQL_pesquisador` (6), `SAL_comparador` (4), `SQL_decisor` (1) |
| `status_oportunidade` | `aberta` (21.324), `ganha` (3.096), `perdida` (150) |

Hoje existem 4 estágios no motor cognitivo: `MQL_pesquisador`, `SAL_comparador`, `SQL_decisor`, `CLIENTE_ativo`. **PQL não existe.**

### Definição das Siglas

| Sigla | Nome | Critério de Entrada |
|---|---|---|
| **MQL** | Marketing Qualified Lead | Chegou por formulário, campanha ou conteúdo. Perguntas genéricas, exploração inicial |
| **PQL** | Product Qualified Lead | `status_oportunidade = 'ganha'` em deal anterior **E** reentrou por formulário/campanha (não por contato direto com vendedor). Já comprou, voltou sozinho |
| **SAL** | Sales Accepted Lead | Vendedor aceitou o lead. Compara modelos, pede demonstração |
| **SQL** | Sales Qualified Lead | Lead qualificado para proposta. Pede prazo, condições, quer fechar |

### Implementação (5 passos)

**1. Migration: Adicionar `PQL_recompra` ao CHECK constraint**
- ALTER da coluna `lead_stage_detected` para aceitar `PQL_recompra` como valor válido
- Sem quebrar os registros existentes

**2. Edge Function `cognitive-lead-analysis` — Adicionar PQL ao prompt e validação**
- Adicionar `PQL_recompra` ao array `VALID_STAGES`
- Atualizar o prompt LLM com a definição:
  - `PQL_recompra`: Já comprou antes (`status_oportunidade = 'ganha'` anterior), retornou por formulário/campanha, pergunta sobre outros produtos do portfólio
- Adicionar lógica determinística: se `status_oportunidade = 'ganha'` e `rota_inicial_lia` não veio de vendedor → forçar `PQL_recompra` independente do LLM

**3. Edge Function `dra-lia` — Nova régua PQL**
- Adicionar `PQL` ao `maturityInstructions` com persona específica:
  - Tom: "Parceiro de evolução" — foco em cross-sell do portfólio
  - Ação: Sugerir produtos complementares ao que já comprou
  - Referência: Usar `produto_interesse` anterior como contexto ("Você já tem o [produto], que tal expandir com...")
- Mapear `PQL_recompra` → chave `PQL` no dicionário de maturity

**4. Edge Function `smart-ops-piperun-webhook` — Tag PQL automática**
- Quando deal status = `won` (oportunidade ganha), se o lead retornar com nova interação via formulário/campanha, adicionar tag `C_PQL_RECOMPRA`
- A lógica de reentrada em nutrição (`C_REENTRADA_NUTRICAO`) já existe; complementar com classificação PQL

**5. Edge Function `smart-ops-ingest-lead` — Detectar PQL na ingestão**
- No momento de ingerir novo lead, verificar se já existe registro com `status_oportunidade = 'ganha'`
- Se sim e a source não é `vendedor_direto` → marcar `lead_stage_detected = 'PQL_recompra'` diretamente, sem esperar o motor cognitivo

### Detalhes Técnicos

```text
Fluxo de detecção PQL:

Formulário/Campanha → ingest-lead
         │
         ▼
  Já existe em lia_attendances
  com status_oportunidade = 'ganha'?
         │
    SIM  │  NÃO
    ▼       ▼
  PQL      MQL (fluxo normal)
```

- O PQL **nunca** é atribuído por contato direto de vendedor — apenas por reentrada autônoma do lead
- O motor cognitivo pode **reclassificar** PQL → SQL se detectar sinais de decisão imediata
- Leads com `status_oportunidade = 'perdida_renutrir'` que reentram NÃO são PQL (não compraram), continuam como MQL

