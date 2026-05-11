## Objetivo expandido

Capturar **100% do que o PipeRun expõe** por deal e transformar isso em três saídas:
1. **Card do Lead** (UI Smart Ops) — trajetória completa, esforço por vendedor, gaps.
2. **Notas no PipeRun** — resumo executivo + alerta de gap para o vendedor agir.
3. **Copilot** — base estruturada para relatórios de produtividade, gargalos de funil e ranking de vendedores.

## O que vamos extrair do PipeRun

Por deal, com paginação e `with[]` agressivo:

| Endpoint | O que captura |
|---|---|
| `GET /deals/{id}` (`with[]=person,company,proposals,activities,files,forms,tags,origin,stage,custom_fields`) | Estado atual completo (já parcial hoje). |
| `GET /activities?deal_id=…` | Calls, meetings, e-mails, propostas, notas, tasks (com user, type, duration, scheduled/completed). |
| `GET /deals/{id}/stage-history` (fallback: derivar de `activities` tipo `stage_change`) | Cada transição com `from_stage`, `to_stage`, `entered_at`, `user`. |
| `GET /tasks?deal_id=…` | Tarefas pendentes/atrasadas (próximo follow-up agendado). |
| `GET /notes?deal_id=…` | Notas do vendedor (já parcial). |
| `GET /files?deal_id=…` | Anexos enviados (proposta PDF, contrato). |
| `GET /emails?deal_id=…` (se disponível na conta) | E-mails enviados/recebidos. |

## Persistência

### `lead_activity_log` — uma linha por toque
`event_type` padronizado (`piperun_call`, `piperun_meeting`, `piperun_email`, `piperun_proposal_sent`, `piperun_note`, `piperun_task_done`, `piperun_task_pending`, `piperun_stage_change`, `piperun_file_uploaded`).
`event_data` guarda `{user_name, user_id, type, raw, from_stage, to_stage, scheduled_at, completed_at}`.
`duration_seconds` para calls/meetings, `value_numeric` para propostas.
Upsert idempotente via índice único `(lead_id, source_channel, entity_id, event_type, event_timestamp)`.

### `deal_status_history` — uma linha por transição
Colunas adicionadas: `deal_id`, `pipeline_id`, `from_stage`, `to_stage`, `days_in_stage`, `owner_name`, `owner_id`.
Permite computar tempo médio por etapa por vendedor / por pipeline.

### `RichDealSnapshot` (em `piperun_deals_history[]`) — agregados prontos para UI

```ts
activities_summary: {
  total: number,
  by_type: { calls, meetings, emails, notes, proposals_sent, tasks_done, tasks_pending, files },
  first_activity_at, last_activity_at,
  days_since_last_activity,
  avg_days_between_activities,
}
stage_journey: Array<{
  stage_name, from_stage, entered_at, exited_at,
  days_in_stage,
  is_current: boolean,
  activities_in_stage: number,
  owner_at_entry: string,
}>
seller_effort: Array<{
  user_id, user_name,
  calls, meetings, emails, notes, proposals, tasks_done, tasks_pending,
  total_activities,
  first_touch_at, last_touch_at,
  stages_owned: string[],   // etapas que esse vendedor segurou
  days_owned: number,        // dias com o deal sob a sua responsabilidade
}>
current_stage_metrics: {
  stage_name, days_in_stage, last_activity_at, days_since_last_activity,
  next_task: { type, scheduled_at, user_name } | null,
}
followup_gaps: Array<{ rule, severity, message, last_event_at, days_overdue }>
```

Tudo pré-computado no sync → UI e Copilot consomem sem reler `lead_activity_log`.

## Notas automáticas no PipeRun

Helper `_shared/followup-gap-analyzer.ts` gera duas notas (debounce por hash em `lia_attendances.last_followup_note_hash`):

1. **🧭 Resumo do Deal — Smart Ops** (atualizada quando o snapshot muda materialmente):
   - Etapa atual + dias parado + última atividade.
   - Esforço total (X calls / Y meetings / Z propostas) por vendedor.
   - Trajetória resumida: `Qualificação (3d) → Negociação (8d, atual)`.
   - Próxima tarefa agendada (ou alerta "sem follow-up").

2. **🚨 Follow-up Gap** (só posta se há gap aberto):
   - Regras default (configuráveis via tabela `followup_gap_rules`):
     - SQL/Negociação sem `call` >7d
     - Proposta enviada sem `call`/`meeting` >5d
     - Qualquer etapa sem nenhuma atividade >10d
     - Tarefa atrasada >2d
   - Severidade: `info`/`warning`/`critical`.

## Card do Lead (UI)

Em `src/components/smartops/KanbanLeadDetail.tsx`, nova aba **"📞 Atividade & Funil"** alimentada por `piperun_deals_history`:

- **Header**: etapa atual, dias parado, última atividade, próxima tarefa.
- **Timeline vertical**: stage_journey com barras proporcionais ao tempo, ícones por tipo de atividade dentro de cada etapa.
- **Tabela "Esforço por Vendedor"**: nome, calls, meetings, propostas, dias com o deal — ordenada por total.
- **Bloco "Gaps abertos"**: lista colorida das regras violadas.
- **Lista cronológica** de atividades (lazy-load de `lead_activity_log` filtrado por `entity_id=deal_id` para detalhe completo, com filtro por tipo/vendedor).

Hook novo `useLeadPiperunActivity(leadId)` agrega de `piperun_deals_history` (rápido) + opcionalmente `lead_activity_log` (detalhado).

## Copilot — relatórios

Novas RPCs SQL consumidas pelo Copilot:

- `query_seller_activity_summary(p_owner_name, p_from, p_to)` → totais por tipo, deals tocados, conversão.
- `query_funnel_stage_residency(p_pipeline_id, p_from, p_to)` → tempo médio por etapa, gargalos, % deals que passaram.
- `query_followup_gaps(p_owner_name?, p_severity?)` → lista de deals com gap aberto.
- `query_deal_activity_timeline(p_deal_id)` → trajetória + atividades.

Adicionar essas tools ao registro do Copilot (`smart-ops-copilot/tools.ts` ou similar) com descrições e exemplos. Memória `[Copilot Intelligence]` é atualizada para incluir essas RPCs.

## Wiring nos syncs

- `piperun-full-sync` e `piperun-incremental-sync` — após `buildRichDealSnapshot`, chamar `fetchDealActivities` + `fetchDealStageHistory` + `fetchDealTasks` + `fetchDealFiles`, persistir em `lead_activity_log` / `deal_status_history`, anexar agregados ao snapshot, rodar gap analyzer.
- `smart-ops-piperun-webhook` — eventos `activity.created/updated`, `deal.stage_changed`, `task.created/completed` gravam em tempo real e re-rodam analyzer.
- Endpoint novo `smart-ops-piperun-activities-backfill` (one-shot, com `dry_run`, `pipeline_id`, `lookback_days`, `lead_ids?`) para popular o histórico existente. Pacing 250ms.

## Migration

```sql
ALTER TABLE deal_status_history
  ADD COLUMN IF NOT EXISTS deal_id text,
  ADD COLUMN IF NOT EXISTS pipeline_id integer,
  ADD COLUMN IF NOT EXISTS from_stage text,
  ADD COLUMN IF NOT EXISTS to_stage text,
  ADD COLUMN IF NOT EXISTS days_in_stage integer,
  ADD COLUMN IF NOT EXISTS owner_id integer,
  ADD COLUMN IF NOT EXISTS owner_name text;

CREATE UNIQUE INDEX IF NOT EXISTS deal_status_history_unique_transition
  ON deal_status_history (lead_id, deal_id, to_stage, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS lead_activity_log_unique_piperun
  ON lead_activity_log (lead_id, source_channel, entity_id, event_type, event_timestamp)
  WHERE source_channel = 'piperun';

CREATE INDEX IF NOT EXISTS lead_activity_log_piperun_owner_idx
  ON lead_activity_log ((event_data->>'user_name'))
  WHERE source_channel = 'piperun';

ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS last_followup_note_hash text,
  ADD COLUMN IF NOT EXISTS last_followup_note_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_deal_summary_note_hash text,
  ADD COLUMN IF NOT EXISTS followup_gap_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_in_current_stage integer,
  ADD COLUMN IF NOT EXISTS days_since_last_activity integer;

CREATE TABLE IF NOT EXISTS followup_gap_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  description text,
  stage_match text,           -- regex/glob (null = qualquer etapa)
  trigger_type text,          -- 'no_activity' | 'no_call_after_proposal' | 'task_overdue'
  threshold_days integer,
  severity text,              -- 'info' | 'warning' | 'critical'
  active boolean default true
);
-- Seeds com 4 regras default.
```

## Validação pós-deploy

1. Backfill no Otavio (deal `59685821`) → `lead_activity_log` com toques, `deal_status_history` com transições, `piperun_deals_history[]` com `stage_journey`, `seller_effort`, `activities_summary`, `current_stage_metrics`.
2. Card do Lead exibe a aba "Atividade & Funil" com timeline + tabela de vendedores + gaps.
3. Nota "🧭 Resumo do Deal" e "🚨 Follow-up Gap" aparecem no PipeRun (verificar via `fetchDealNotes`).
4. Copilot responde "qual o tempo médio na etapa Negociação?" usando `query_funnel_stage_residency`.

## Arquivos alterados

- `supabase/functions/_shared/piperun-field-map.ts` — `fetchDealActivities`, `fetchDealStageHistory`, `fetchDealTasks`, `fetchDealFiles`; `RichDealSnapshot` com `activities_summary`, `stage_journey`, `seller_effort`, `current_stage_metrics`, `followup_gaps`.
- `supabase/functions/_shared/piperun-activities-persist.ts` — novo, upsert em `lead_activity_log` + `deal_status_history`.
- `supabase/functions/_shared/followup-gap-analyzer.ts` — novo, regras + builder de notas.
- `supabase/functions/piperun-full-sync/index.ts` e `piperun-incremental-sync/index.ts` — wiring.
- `supabase/functions/smart-ops-piperun-webhook/index.ts` — handlers de `activity.*`, `task.*`, `deal.stage_changed`.
- `supabase/functions/smart-ops-piperun-activities-backfill/index.ts` — novo, one-shot.
- `supabase/functions/_shared/seller-summary.ts` — seção "Follow-up & Esforço".
- `supabase/functions/smart-ops-copilot/*` — novas tools + descrições.
- `src/components/smartops/KanbanLeadDetail.tsx` — aba "📞 Atividade & Funil".
- `src/hooks/useLeadPiperunActivity.ts` — novo hook.
- Migration nova com ALTERs + tabela `followup_gap_rules` + seeds.

## Perguntas antes de implementar

1. **Regras de gap default** ok com (a) SQL sem call >7d, (b) proposta sem follow-up >5d, (c) etapa sem atividade >10d, (d) task atrasada >2d? Ou ajustar números?
2. **Frequência das notas no PipeRun**: posto a nota "🧭 Resumo do Deal" a cada sync que detecta mudança material (recomendado), ou só 1×/dia por deal?
3. **Backfill inicial**: rodar para todos os pipelines (Vendas + CS + Suporte) ou começar só por Vendas para validar?