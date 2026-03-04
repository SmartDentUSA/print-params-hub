

# Plano: Completar LIA_SYSTEM_FIELDS com todos os campos faltantes

## Problema
O array `LIA_SYSTEM_FIELDS` em `src/utils/leadParsers.ts` (linhas 697-856) tem ~120 campos mas está faltando ~30 campos reais da tabela `lia_attendances`, incluindo campos PipeRun, propostas e outros.

## Campos faltantes identificados

Comparando o schema completo com o array atual, faltam:

| Campo | Label proposto |
|-------|---------------|
| `piperun_closed_at` | PipeRun Fechado Em |
| `piperun_created_at` | PipeRun Criado Em |
| `piperun_custom_fields` | PipeRun Campos Custom |
| `piperun_deleted` | PipeRun Deletado |
| `piperun_description` | PipeRun Descrição |
| `piperun_frozen` | PipeRun Congelado |
| `piperun_frozen_at` | PipeRun Congelado Em |
| `piperun_hash` | PipeRun Hash |
| `piperun_last_contact_at` | PipeRun Último Contato |
| `piperun_lead_time` | PipeRun Lead Time |
| `piperun_observation` | PipeRun Observação |
| `piperun_origin_id` | PipeRun Origin ID |
| `piperun_origin_name` | PipeRun Origin Name |
| `piperun_owner_id` | PipeRun Owner ID |
| `piperun_pipeline_id` | PipeRun Pipeline ID |
| `piperun_pipeline_name` | PipeRun Pipeline Name |
| `piperun_probability` | PipeRun Probabilidade |
| `piperun_probably_closed_at` | PipeRun Previsão Fechamento |
| `piperun_stage_changed_at` | PipeRun Data Mudança Etapa |
| `piperun_stage_id` | PipeRun Stage ID |
| `piperun_stage_name` | PipeRun Etapa |
| `piperun_status` | PipeRun Status |
| `piperun_title` | PipeRun Título |
| `piperun_value_mrr` | PipeRun Valor MRR |
| `proposals_data` | Propostas Data (JSON) |
| `proposals_last_status` | Propostas Último Status |
| `proposals_total_mrr` | Propostas Total MRR |
| `proposals_total_value` | Propostas Total Valor |
| `empresa_custom_fields` | Empresa Campos Custom |
| `intelligence_score_total` | Intelligence Score Total |
| `proactive_count` | Proactive Count |
| `proactive_sent_at` | Proactive Enviado Em |
| `rota_inicial_lia` | Rota Inicial LIA |
| `resumo_historico_ia` | Resumo Histórico IA |
| `status_atual_lead_crm` | Status Atual Lead CRM |

## Alteracao

### `src/utils/leadParsers.ts`
- Inserir os ~35 campos faltantes no array `LIA_SYSTEM_FIELDS`, mantendo a ordem alfabetica existente
- Adicionar `piperun_value_mrr` e `proposals_total_value`/`proposals_total_mrr` ao set `MONEY_FIELDS` (ja presente, confirmar)

Nenhuma outra alteracao necessaria — o componente `SmartOpsLeadImporter` ja consome o array dinamicamente.

