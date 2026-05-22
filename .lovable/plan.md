# Enriquecimento + Criação de leads a partir do dump PipeRun

## Objetivo
Usar o dump de **72.417 deals** já extraído (`/mnt/documents/piperun_deals_full.json`) para:
1. **Enriquecer** leads existentes em `lia_attendances` (atualizar owner, stage, status, valor, deals_history, LTV).
2. **Criar** os leads que existem no PipeRun mas **não** estão na nossa base.
3. **NÃO** chamar a API do PipeRun para escrever nada. Tudo fica local — sincronização será feita por você depois.

## Situação atual
- Base canônica: **30.107** leads (`merged_into IS NULL`)
- Com `piperun_id`: 29.159 / com `pessoa_piperun_id`: 25.758
- Dump PipeRun: 72.417 deals, mas o payload de `/deals` **não traz email/nome/telefone da pessoa** — só `person_id`, `company_id`, `owner_id`.

Ou seja: para criar leads novos precisamos buscar os dados de cada `person_id` único via `GET /persons/{id}`.

## Etapas

### Etapa 1 — Indexar deals por person_id (local, sem API)
- Ler o JSON, agrupar por `person_id`.
- Estimativa: ~40-50k pessoas únicas.
- Cruzar contra `lia_attendances.pessoa_piperun_id` para separar em **2 buckets**:
  - **EXISTENTES** (~25.7k) → vão pro enrichment
  - **FALTANTES** (~15-25k) → precisam fetch /persons + criação

### Etapa 2 — Enriquecer leads existentes (sem API, só DB)
Para cada lead com `pessoa_piperun_id` presente no dump:
- Recalcular `piperun_deals_history` (append-only, dedup por `deal_id` — respeitando memória "Incremental Lead Policy").
- Recalcular `ltv_total` = soma dos deals ganhos.
- Recalcular `total_deals` (ganhos) e `total_deals_all` (todos).
- Atualizar `piperun_id`, `proprietario_lead_crm` (via owner_id → seller lookup), `funil_entrada_crm`, `ultima_etapa_comercial`, `status_oportunidade` com o **deal mais recente** do PipeRun.
- Grava via UPDATE em lote (RPC ou edge function com service role).
- **Guard**: respeitar "PostgREST embed-update guard" — só valores escalares.

### Etapa 3 — Buscar pessoas faltantes no PipeRun (READ-only)
- Para cada `person_id` que **não** existe em `lia_attendances`, chamar `GET /persons/{id}`.
- Throttle: 60 req/min (mesmo padrão da extração de deals).
- Capturar: `name`, `emails[0].email`, `phones[0].phone`, `company_id`, `job_title`, `created_at`, `origin_id`.
- Salvar dump intermediário em `/mnt/documents/piperun_persons_missing.json` para auditoria/retomada.
- Tempo estimado: 4-7h dependendo do volume real (será reportado após indexação da Etapa 1).

### Etapa 4 — Criar leads faltantes em `lia_attendances`
Para cada pessoa nova:
- **Identidade**: aplicar policy "Identity & Merging" (piperun_id > email > phone). Antes de inserir, fazer um último check anti-dup por email/telefone normalizado.
- **Telefone**: normalizar via `normalizeBrazilianPhone`.
- **Email fake**: marcar `email_is_fake=true` se cair em `isFakeEmail`.
- **Timestamp**: usar `created_at` real do PipeRun (memória "Timestamps").
- **Origem**: mapear `origin_id` para `origem_primeiro_contato` quando possível.
- **Owner**: setar `proprietario_lead_crm` via lookup `owner_id` → sellers.
- **piperun_id**: do deal mais recente da pessoa.
- **pessoa_piperun_id**: o person_id.
- **piperun_deals_history**: array completo dos deals dessa pessoa.
- **ltv_total / total_deals**: calculado.
- **merged_into**: NULL (canônico).
- **NÃO** disparar `smart-ops-lia-assign`, `smart-ops-ingest-lead` nem qualquer webhook que reenvie pro PipeRun.

### Etapa 5 — Relatório final em `/mnt/documents/`
- `enrichment_report.txt`: quantos leads atualizados, quantos criados, quantos com conflito (skip), LTV agregado antes/depois.
- `enrichment_skipped.csv`: pessoas que não conseguimos resolver (sem email nem telefone, ou duplicata ambígua).
- `enrichment_created.csv`: IDs novos criados.

## Como vai rodar
- **Etapa 1, 2** → script Node/Deno no sandbox + RPC `supabase` (preciso criar uma RPC SECURITY DEFINER `enrich_lead_from_piperun_dump` para fazer o UPDATE em lote sem expor service_role; ou rodar via edge function dedicada `piperun-offline-enrichment`).
- **Etapa 3** → script no sandbox usando `PIPERUN_API_KEY` (apenas GET, nenhum POST/PUT).
- **Etapa 4** → edge function `piperun-offline-create-leads` (INSERT em `lia_attendances` com service role).
- **Etapa 5** → script no sandbox.

## Garantias / não-objetivos
- **ZERO escrita no PipeRun.** Nenhuma chamada POST/PUT/DELETE.
- **Não** dispara `lia-assign`, `dynamic-lead-ingestion`, `meta-lead-webhook`, ou qualquer trigger que crie/atualize deal no CRM.
- **Não** mexe em leads com `merged_into IS NOT NULL` (só canônicos).
- **Não** sobrescreve `origem_primeiro_contato` se já preenchido (Person Origin Frozen).
- Append-only para `piperun_deals_history` (dedup por deal_id).

## Perguntas antes de executar
1. **Confirma fetch das ~15-25k pessoas faltantes via `GET /persons/{id}`?** É read-only, mas leva 4-7h e consome rate limit. Alternativa: pular criação e fazer só enrichment dos 25.7k já mapeados.
2. **Enrichment deve sobrescrever `proprietario_lead_crm` atual** se o owner no PipeRun mudou, ou só preencher quando estiver vazio?
3. **Leads criados ficam com `status_lead = 'novo'`** ou herdam algum status baseado nos deals (ex: tem deal ganho → `cliente_ativo`)?
