## Diagnóstico do CSV "07_05_2026 RayShape+Cure" (846 leads únicos do Meta Lead Ads)

Cruzamento dos 846 emails do CSV com `lia_attendances` (canônicos):

| Status | Qtd | % |
|---|---:|---:|
| ✅ No DB **com** `piperun_id` | **461** | 54,5% |
| ⚠️ No DB **sem** `piperun_id` (lia-assign falhou) | **61** | 7,2% |
| ❌ Nem chegou ao DB (Meta webhook nunca disparou ingest-lead) | **324** | 38,3% |

Ou seja: **385 dos 846 leads (45,5%) NÃO foram ao Piperun.**

### Causa #1 — 61 leads no DB sem `piperun_id` (falha CRM sync)
Mesma raiz já identificada no plano anterior:
- `findPersonByEmail` chama `GET /persons?email=...` — Piperun ignora esse parâmetro → todo lead existente é tratado como novo.
- `createPerson` envia custom field `674001` (PESSOA AREA_ATUACAO) inválido → 422 `"Não foi possível encontrar os campos customizados: ."`.
- Retry sem custom_fields não está recuperando.
- Resultado: lia-assign aborta com `crm_person_creation_failed`. Logs em `system_health_logs` confirmam (243 falhas / 51 leads em 7 dias).

### Causa #2 — 324 leads NUNCA entraram no DB (Meta Lead Ads webhook não processou)
Esses leads existem no painel do Meta (CSV exportado do Facebook), mas não têm registro em `lia_attendances`. Possíveis causas:
1. **Webhook subscription incompleta no Meta**: o app/page do Meta não está inscrito no campo `leadgen` para a Page que serviu o ad `# 07_05_2026_RayShape+Cure`, ou o token da Page expirou.
2. **`META_VERIFY_TOKEN` / `META_APP_SECRET` inválido**: webhooks chegam mas falham validação HMAC silenciosamente (404/401).
3. **Form `# - Impresoras - Smart Dent` (id 4309081142703799)** não está mapeado no fluxo do meta-lead-webhook, ou está caindo em early-return.
4. **Latência/falha no `fetch leadgen_id` do Graph API**: token da Page expirado faz `GET /{leadgen_id}` retornar 400/403 → o webhook descarta o lead.
5. Webhooks recebidos antes do deploy atual existir (leads de 07/05; integração ativa só depois).

Os 461 que chegaram ao Piperun correspondem em sua maioria a leads que:
- Foram importados via CSV manual / Sellflux / outro caminho que não o webhook em tempo real.
- Ou entraram pelo webhook após a integração estar saudável.

---

## Plano de correção (estendendo o plano anterior)

### Passo 1 — Corrigir `findPersonByEmail` + remover custom field 674001
(Mesmas 2 correções já planejadas — bloqueiam os 61 leads sem `piperun_id` E também todos os novos que entrarem.)

### Passo 2 — Reprocessar os 61 leads "no DB sem piperun_id"
Rodar `smart-ops-piperun-retry-failed-leads` com filtro pela lista de 846 emails do CSV (limit 100, em loop). Tornar a função aceitar um array `emails[]` opcional no body para targeting:
```ts
body: { emails: [...846 emails do CSV...], force: true, limit: 100 }
```

### Passo 3 — Auditoria do Meta Lead Ads webhook (recuperar os 324 perdidos)
3.1. **Diagnóstico de subscription**: criar pequena edge function `smart-ops-meta-leads-audit` que chama `GET /{page_id}/subscribed_apps` e `GET /{page_id}/leadgen_forms?fields=id,name,leads{created_time,id,field_data}&limit=200&since=2026-05-06` para o form `4309081142703799`. Compara com `lia_attendances.raw_payload->>'meta_leadgen_id'` e identifica exatamente quais `leadgen_id` foram perdidos.

3.2. **Backfill batch**: para cada `leadgen_id` perdido, chamar `smart-ops-meta-lead-webhook` com payload sintético `{ object: 'page', entry: [{ changes: [{ value: { leadgen_id, form_id, page_id, created_time, ad_id } }] }] }` para reusar o pipeline existente. Idempotência já existe via `meta_leadgen_id` no DB.

3.3. **Importador CSV de fallback (one-shot)**: como o CSV já está em mãos com todos os campos preenchidos, criar script `import-meta-csv` (admin-only) que aceita upload do CSV exportado do Meta e converte cada linha em payload normalizado para `smart-ops-ingest-lead` (mesmo schema do meta-lead-webhook). Isso garante recuperação dos 324 leads imediatamente, sem depender da Graph API. Marca `raw_payload.import_source = 'meta_csv_backfill'` para auditoria.

### Passo 4 — Validação
- Re-rodar a query de cruzamento e confirmar que ≥99% dos 846 emails têm `piperun_id`.
- Verificar `system_health_logs` zerar `crm_person_creation_failed` em 24h.
- Conferir 5 leads aleatórios da lista no Piperun: Person criada/encontrada, Deal no funil correto (Vendas ou Distribuidor), nota Piperun com origem `Meta Ads — # Leads RayShape+Cure`.

### Passo 5 — Hardening (preventivo)
- Healthcheck diário: cron compara `count(meta_leadgen_id)` últimos 24h vs estimativa do Meta API → alerta se gap > 10%.
- Alarm em `system_health_logs.severity = 'error'` AND `function_name LIKE '%lia-assign%'`.

---

## O que NÃO mexer
- Pipeline Vendas / Distribuidor / Round-Robin: funcionam, o gargalo é upstream.
- Schema `lia_attendances`.
- Forms públicos / Sellflux / Loja Integrada — fora do escopo do CSV em questão.

## Resumo executivo
**385 de 846 leads (45,5%) ficaram fora do Piperun.** 61 falharam por bug em `findPersonByEmail` + custom field inválido (Passo 1). 324 nunca chegaram ao sistema porque o webhook Meta não processou — o CSV em mãos permite backfill imediato (Passo 3.3). Após Passo 1+2+3 espera-se cobertura ≥99%.
