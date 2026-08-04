# Paridade CRM: os mesmos dados dos arquivos, agora em tempo real (webhook + API)

## Situação verificada

A ingestão dos XLSX populou a timeline com:

| Evento | Linhas | Fonte hoje |
|---|---|---|
| `crm_activity` | 46.047 | XLSX **e** webhook (paridade OK) |
| `crm_deal_updated` / `_created` / `_won` | 155.366 | webhook (OK) |
| `crm_deal_snapshot` | 8.870 | **somente XLSX** |
| `crm_proposal` | 1.269 | **somente XLSX** |

Ou seja: propostas e snapshots de funil/etapa só existem porque veio planilha. Nada no fluxo contínuo os grava — o webhook agrega propostas apenas em colunas de `lia_attendances` (`proposals_data`, `proposals_total_value`), sem gerar evento de timeline. Sem os arquivos, o Painel Comercial volta a divergir a partir de hoje.

## O que fazer

### 1. Webhook grava proposta como evento (paridade com o arquivo)
Em `smart-ops-piperun-webhook`, após montar o `dealSnapshot`, emitir um evento `crm_proposal` por proposta (mesmo shape do ingest XLSX: `entity_id = proposal_id`, `event_timestamp` = data real da proposta no CRM, `value_numeric` = total, status no `event_data`). Dedupe por `entity_id`, então re-envios do PipeRun e reprocessos não duplicam. Continua gravando as colunas agregadas como hoje.

### 2. Webhook grava snapshot de etapa
Ainda no webhook, emitir `crm_deal_snapshot` (funil, etapa, origem, valor, status) usando a data real de mudança de etapa (`last_stage_updated_at` / `stage_updated_at`), com dedupe por `deal_id + etapa + data`. Isso substitui a planilha na alimentação do funil por banda do painel.

### 3. Reconciliador por API para o que o webhook não cobre
Nova função `crm-timeline-reconciler` (cron 30 min), lendo direto da API do PipeRun os deals alterados na janela e completando `crm_proposal`, `crm_deal_snapshot` e `crm_activity` faltantes — mesma lógica de resolução de identidade do ingest XLSX (`deal_id` → `pessoa_piperun_id` → e-mail, sempre `merged_into IS NULL`). Cobre webhook perdido, timeout e deal alterado fora de evento.

### 4. Fila de não resolvidos
Registros cujo lead não é encontrado passam a ir para uma tabela de pendências (`crm_timeline_unresolved`) em vez de serem descartados, com contador e reprocesso automático quando o lead aparecer. Hoje o ingest apenas ignora.

### 5. Reprocesso único de nivelamento
Rodar o reconciliador em modo backfill sobre 01/07/2026–04/08/2026 para conferir que API e planilha convergem no mesmo total (propostas ≈ 1.277 únicas, atividades da janela) e reportar qualquer diferença antes de considerar o pipeline fechado.

## Regras respeitadas
- Nunca `now()`: sempre a data real do evento no CRM.
- Somente leads canônicos (`merged_into IS NULL`).
- Nenhuma alteração em funil CS ou Vendas (Golden Rule intacta) — este trabalho só grava timeline/leitura.
- Sem alteração em `lia_attendances` além do que o webhook já escreve.

## Detalhes técnicos
- Arquivos: `supabase/functions/smart-ops-piperun-webhook/index.ts`, novo `supabase/functions/crm-timeline-reconciler/index.ts`, novo `_shared/crm-timeline-events.ts` (emissor único usado por webhook, reconciliador e ingest XLSX para garantir shape idêntico).
- Migração: tabela `crm_timeline_unresolved` (com GRANTs + RLS admin/service_role) e índice único de dedupe em `lead_activity_log` para `crm_proposal`/`crm_deal_snapshot`.
- Cron: entrada `pg_cron` de 30 min, fora da janela 02:00–04:30 já congestionada.
