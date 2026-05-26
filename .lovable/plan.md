## Contexto

Você reestruturou o Funil de Vendas (pipeline 18784) no PipeRun. Busquei as etapas atuais via `GET /stages?pipeline_id=18784` e confirmei a estrutura nova:

| Ordem | Nome no PipeRun | stage_id numérico | Status anterior |
|---|---|---|---|
| 0 | Sem contato | 99293 | igual |
| 1 | C1 | 99294 | renomeado (era "Contato Feito") |
| 2 | C2 | **675815** | NOVO |
| 3 | C3 | **675813** | NOVO |
| 4 | SDR / Nutrição | 379942 | renomeado (era "Em Contato") |
| 5 | Apresentação/Visita | 99295 | igual |
| 6 | Proposta enviada (TEMP) | 99296 | igual |
| 7 | Negociação | 448526 | igual |
| 8 | LTV | **674146** | NOVO |
| 9 | Fechamento | 99818 | igual |

Etapas antigas que sumiram do funil: nenhuma — só houve renomeação e inserção. Vamos preservar os IDs numéricos e atualizar nomes/novas etapas.

## Mudanças

### 1. `supabase/functions/_shared/piperun-field-map.ts`

- Atualizar `STAGES_VENDAS`:
  ```ts
  SEM_CONTATO: 99293,
  C1: 99294,           // antes CONTATO_FEITO
  C2: 675815,          // NOVO
  C3: 675813,          // NOVO
  SDR_NUTRICAO: 379942, // antes EM_CONTATO
  APRESENTACAO_VISITA: 99295,
  PROPOSTA_ENVIADA: 99296,
  NEGOCIACAO: 448526,
  LTV: 674146,         // NOVO
  FECHAMENTO: 99818,
  ```
- Manter aliases legacy (`CONTATO_FEITO = 99294`, `EM_CONTATO = 379942`) com `@deprecated` para não quebrar imports existentes (`piperun-hierarchy.ts` etc).
- Atualizar `STAGE_TO_ETAPA`:
  ```
  99293 → "sem_contato"
  99294 → "c1"             (era "contato_feito")
  675815 → "c2"            (novo)
  675813 → "c3"            (novo)
  379942 → "sdr_nutricao"  (era "em_contato")
  99295 → "apresentacao"
  99296 → "proposta_enviada"
  448526 → "negociacao"
  674146 → "ltv"           (novo)
  99818 → "fechamento"
  ```

### 2. `supabase/functions/pipeline-funnel-data/index.ts` (bandas do funil agregado)

Atualizar `STAGE_BANDS` por nome:
- `"Sem contato"`, `"C1"`, `"C2"`, `"C3"`, `"SDR / Nutrição"` → `em_processo` (<60)
- `"Apresentação/Visita"` → `boas_chances` (60-80)
- `"Proposta enviada (TEMP)"`, `"Negociação"` → `comprometido` (90)
- `"LTV"`, `"Fechamento"` → `conquistado` (100)
- Manter chaves antigas (`"Contato Feito"`, `"Em Contato"`, `"Proposta enviada"`) como aliases para deals históricos cujo `stage_name` foi snapshotado antes da renomeação.

### 3. Frontend Kanban / Audience / Leads

- `src/components/SmartOpsKanban.tsx`: substituir colunas `contato_feito`/`em_contato` por `c1`, `c2`, `c3`, `sdr_nutricao`, adicionar `ltv`. Manter rótulos amigáveis e cores na mesma paleta atual (semantic tokens).
- `src/components/SmartOpsLeadsList.tsx` e `src/components/SmartOpsAudienceBuilder.tsx`: atualizar arrays `statuses` do Vendas para o novo conjunto, mantendo `novo` e `sem_contato` no início e `fechamento` no fim.

### 4. `supabase/functions/_shared/sellflux-field-map.ts`

Adicionar entradas de tag para os novos status (`c1`, `c2`, `c3`, `sdr_nutricao`, `ltv`) — espelhando a mesma jornada (`J02_CONSIDERACAO` para C1/C2/C3/SDR; `J03+` para LTV, alinhado a Fechamento). Manter `contato_feito` e `em_contato` como aliases para histórico.

### 5. Backfill de dados existentes (migration)

Atualizar leads/deals que já estão no banco com os labels antigos para os novos:
- `UPDATE lia_attendances SET ultima_etapa_comercial='c1' WHERE ultima_etapa_comercial='contato_feito';`
- `UPDATE lia_attendances SET ultima_etapa_comercial='sdr_nutricao' WHERE ultima_etapa_comercial='em_contato';`
- Idem em `deals.stage_name` se necessário (a sync incremental do PipeRun já vai sobrescrever, mas faço o UPDATE explícito por segurança).

### 6. Reconciliação / verificação

Após deploy:
1. Disparar `smart-ops-sync-piperun?orchestrate=true&pipeline_id=18784&since_hours=72` para puxar todos os deals movidos hoje.
2. Disparar `smart-ops-piperun-funnel-reconciler?hours=72` para confirmar gap=0.
3. Conferir no painel admin → SmartOpsReports / Relatório Mensal Comercial se os novos bandas/etapas aparecem corretamente.

### 7. Memória

Criar `mem://integration/piperun-funil-vendas-v2` documentando o novo layout (10 etapas, 3 novas: C2/C3/LTV; 2 renomeadas: C1/SDR-Nutrição).

## Não muda

- IDs de pipelines (18784 segue).
- Outros funis (Estagnados, CS, Insumos, E-commerce).
- Lógica de bandas / RPCs do Relatório Mensal.
- RLS, schema de tabelas, edge functions de WhatsApp/Omie.
