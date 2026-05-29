# Plano: fechar o gap silencioso de Meta → ingest-lead

Objetivo: nunca mais ter form_name mudando em `lia_attendances` sem a régua universal de enrichment rodar, e recuperar a Anara agora.

## 1. Telemetria total no `smart-ops-ingest-lead`
- Log obrigatório em `system_health_logs` no início (`ingest_lead_received`) e fim (`ingest_lead_completed` / `ingest_lead_rejected`) de cada invocação.
- Payload inclui: `leadgen_id`, `form_id`, `email`, `phone`, `source`, `decision` (created/matched/dedup/rejected), `lead_id` final, `http_status`.
- Loga também 4xx (payload inválido, missing identifiers) — hoje somem.
- Objetivo: provar de forma irrefutável se Meta chamou ou não.

## 2. Safety-net trigger + cron
- Estender `fn_log_form_submission_to_timeline`: quando detecta `OLD.form_name IS DISTINCT FROM NEW.form_name` em lead `source='meta_lead_ads'`, insere uma linha em nova tabela `enrichment_safety_queue (lead_id, detected_at, old_form_name, new_form_name, processed_at)`.
- Novo cron `enrichment-safety-net` (1×/min) lê fila não-processada com idade > 30s e chama `smart-ops-lia-assign` com `enrichment_only_route_deal=true` para cada lead.
- Marca `processed_at` ao final. Idempotente via `commercial-intent guard` + lock TTL existentes.
- Garante CASE A/B/C universal mesmo se o UPDATE veio de fora do ingest-lead.

## 3. Backfill defensivo no `smart-ops-ingest-lead`
- No path `existingLead` (match por email/phone), quando canônico tem `platform_lead_id IS NULL` ou `platform_form_id IS NULL` e o payload atual tem esses campos → preencher imediatamente.
- Hoje só acontece nos paths de dedupe; falta no caminho normal.

## 4. Recuperação imediata da Anara
- Invocação one-shot de `smart-ops-lia-assign` com `enrichment_only_route_deal=true` para `d9ec9bc4-49bd-4c2d-a3a3-f5d45cac0eaf`.
- Régua roda live no PipeRun:
  - CASE A (deal 60068318 ainda aberto em VENDAS) → só enriquece + posta nota do novo form.
  - CASE B+C (deal fechado/movido) → fecha não-CS como Perdido + Fresh Round Robin + novo VENDAS, preservando CS.

## Arquivos afetados
- `supabase/functions/smart-ops-ingest-lead/index.ts` — telemetria + backfill.
- `supabase/functions/smart-ops-lia-assign/index.ts` — nenhum (já tem o route).
- Nova edge function `enrichment-safety-net-cron`.
- Migration: tabela `enrichment_safety_queue` + GRANTs + RLS + extensão do trigger `fn_log_form_submission_to_timeline` + agendamento `pg_cron`.
- Script one-shot de recuperação via `supabase--curl_edge_functions` (não vai a arquivo).

## O que NÃO muda
- Nenhuma UI.
- Nenhum CS deal tocado.
- Golden Rule preservada (VENDAS aberto → enrich, nunca recria).
- Commercial Intent Guard preservado.

## Verificação pós-deploy
1. `system_health_logs` mostra `ingest_lead_received` em toda chamada.
2. Forçar mudança de `form_name` em um lead teste → fila populada → cron processa → log de `enrichment_only_route_deal` no `lia-assign`.
3. Lead Anara: após one-shot, `form_data.enrichment_history` populado + nota no PipeRun no deal 60068318 (ou novo deal se aplicável).