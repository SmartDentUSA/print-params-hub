## Reprocessamento controlado dos 355 leads Meta sem CRM

Origem: `meta-mes-sem-crm.csv` (355 linhas). Objetivo: rodar cada lead pelo mesmo caminho de um novo formulário Meta, disparando o escape hatch **Estagnados → Vendas** (fecha deal 72938 como Perdido "Solicitou novo contato" e abre novo em 18784 com round-robin) — mas SOMENTE quando o canonical estiver em Estagnados. Fila de 10 leads a cada 30 min.

### Regra absoluta (reforçada)

**Nenhum deal em CS (83896 / 102893 / 104500) ou VENDAS (18784), independente do status (aberto, ganho, perdido, congelado), pode ser tocado.** O worker checa `piperun_deals_history` do canonical ANTES de invocar `lia-assign`:

- Se existe **qualquer** deal em Vendas ou CS (qualquer status) → marca `status='skipped_protected_pipeline'`, grava motivo, **não invoca lia-assign**.
- Só invoca reativação quando o único histórico é Estagnados (72938) ou pipelines livres.
- Isso é uma trava de segurança do worker, adicional aos guards já existentes em `lia-assign` / `vendas-pipeline-immutability` / `golden-rule`.

### 1. Fila de reprocessamento

Migration cria `meta_sem_crm_reprocess_queue`:
`id, csv_row, nome, email, telefone_raw, telefone_normalized, form_name, produto_interesse, created_time, status, attempts, last_error, scheduled_at, processed_at, canonical_id_before, canonical_pipeline_before, deal_vendas_id_after, skip_reason`.

Status possíveis: `pending | processing | done | failed | skipped_phone_invalid | skipped_protected_pipeline | skipped_no_canonical_change`.

Grants + RLS admin-only + trigger updated_at.

### 2. Seed one-shot

Edge function `meta-sem-crm-seed` lê o CSV (payload inline) e popula a fila:
- **Telefone**: `normalizeBrazilianPhone` (`supabase/functions/_shared/phone-normalize.ts`). Se retornar `null` ou `+` não-BR sem email válido → `skipped_phone_invalid`.
- **produto_interesse por form_name**:
  - `# - FACE - E-BOOK VITALITY` → `Resina 3D Smart Print Bio Vitality`
  - `BLZ- Smart Dent` → `Scanner Intraoral BLZ INO200`
  - `# - GlazeON- Smart Dent` → `GlazeON - Splint`
  - `# - Impressoras 3D - Smart Dent` → `Impressora 3D`
  - outros → vazio, sinaliza no log
- `scheduled_at`: distribui 10 leads por janela de 30 min a partir de `now()` → ~18h total.

### 3. Worker `meta-sem-crm-reprocess-worker`

Edge function invocada por `pg_cron` a cada 5 min:
1. Pega até 10 rows `status='pending' AND scheduled_at <= now()`, marca `processing`.
2. Para cada lead:
   - Busca canonical em `lia_attendances` por email/telefone (usando `merged_into IS NULL`).
   - Se canonical existe → lê `piperun_deals_history`.
   - **Guard protegido**: se qualquer deal em 18784, 83896, 102893, 104500 (qualquer status) → `skipped_protected_pipeline`, motivo detalhado, próximo.
   - Se canonical em pipeline 72938 (Estagnados) OU sem canonical → invoca `smart-ops-ingest-lead` com payload simulando o formulário original (`source='meta_lead_ads_reprocess'`, `form_name`, `produto_interesse`, `platform_lead_id='reprocess_<row>'`, `raw_payload`).
   - O ingest cai na rota B do escape hatch (mem `estagnados-redelivery-reactivation`) e chama `lia-assign` com `trigger='sdr_captacao_reativacao'`, `force:true`. `lia-assign` faz o close+reopen apenas se as regras dele permitirem (elas já tratam Vendas/CS como imutáveis).
3. Grava `deal_vendas_id_after`, status final. `attempts++`, máx 3 antes de `failed`.

Sem alterar código de `lia-assign`, `golden-rule-guard`, `commercial-intent`, `ingest-lead`. Só nova camada de fila + worker.

### 4. UI de monitor

Página `/admin/meta-reprocess-monitor` (protegida por `has_role admin`):
- Contadores por status.
- Tabela paginada da fila com filtros.
- Botão "Pausar cron" (flag `meta_sem_crm_worker_paused` em `system_config`, checada pelo worker).
- Botão "Reprocessar falhas" (reset `attempts=0`, `status='pending'`).

Registrada como nova aba no `AdminViewSupabase`.

### 5. Relatório final

Quando fila esvaziar: gerar `/mnt/documents/meta-sem-crm-reprocess-report.csv` + resumo `.md` com breakdown por status, deals criados em Vendas, vendedores sorteados, motivos de skip.

### O que NÃO alterar

- Nenhum deal em Vendas (18784) ou CS (83896/102893/104500), independente do status — trava dupla: no worker (pré-check) e nos guards já existentes.
- Nenhuma linha de `smart-ops-lia-assign`, `golden-rule-guard`, `commercial-intent`, `ingest-lead`, `meta-lead-ads-pull`.
- Não sobrescreve `produto_interesse` já preenchido no canonical.

### Ordem em build mode

1. Migration da fila (tabela + grants + RLS + trigger).
2. Edge functions `meta-sem-crm-seed` e `meta-sem-crm-reprocess-worker` + `config.toml`.
3. Rodar seed com CSV inline.
4. Agendar `pg_cron` `*/5 * * * *` via `supabase--insert`.
5. UI de monitor.
