## Verificação temporal (CS + Estagnados) + Lista de leads sem CRM

### 1. Verificação data-formulário vs data-deal (306 leads)

Para cada um dos **292 Estagnados** e **14 CS**, cruzar:

- **Data do formulário Meta**: `meta_created_time` (fallback: `created_at` do último evento de ingestão em `meta_lead_ingestion_log` ou `lead_form_submissions.submitted_at`).
- **Data do deal existente**: `last_deal_date` + varredura de `piperun_deals_history` filtrado pelo `pipeline_id` (72938 Estagnados / 83896 CS) para pegar o `updated_at` mais recente do deal daquele funil.

Classificação por lead:

| Flag | Regra | Ação esperada pela política |
|---|---|---|
| `FORM_APOS_DEAL` | form_date > last_deal_date do funil | Deveria ter aberto novo deal em **Vendas** |
| `FORM_ANTES_DEAL` | form_date ≤ last_deal_date | Correto ficar no CS/Estagnados sem novo Vendas |
| `SEM_DATA_DEAL` | histórico incompleto | Investigar caso a caso |

Saída → `/mnt/documents/meta-mes-cs-estagnados-verificacao-temporal.csv` com colunas:

`bucket | piperun_id | nome | email | telefone | form_name | form_date | last_deal_date_bucket | dias_gap | flag | piperun_stage_name | proprietario`

Um resumo `.md` acompanha com totais por flag e por funil.

### 2. Lista completa dos ~171 leads sem CRM / não ingestado

Fonte da verdade: `user-uploads://Leads_meta_mês.csv` (946 rows) já usado nas auditorias anteriores.

Método:

1. Carregar o CSV do Meta.
2. Normalizar `email` (lower/trim) e `telefone` (só dígitos, últimos 10-11).
3. `LEFT JOIN` contra `lia_attendances` (canônicos, janela 30/06 → 22/07) por email OU telefone normalizado.
4. Filtrar `piperun_id IS NULL AND lia_id IS NULL` — sem espelho e sem CRM.

Saída → `/mnt/documents/meta-mes-sem-crm.csv` com colunas do próprio CSV Meta + diagnóstico:

`created_time | form_name | full_name | email | phone_number | area_atuacao | scanner | impressora | motivo_falha`

`motivo_falha` deriva de: `meta_lead_ingestion_log` (se existe evento mas falhou), `meta_lead_event_buffer` (retido), `cron_state.meta_pull_forms` (form_id não estava na lista de pull) ou `nao_ingestado` (nenhum registro).

Um resumo agrupando `motivo_falha × form_name` acompanha em `.md`.

### O que NÃO tocar

- Nenhum deal é movido, criado ou fechado.
- Nenhum código de decisão (`smart-ops-lia-assign`, Golden Rule, funis CS/Vendas/Estagnados) é alterado.
- Apenas geração de relatórios read-only em `/mnt/documents/`.
