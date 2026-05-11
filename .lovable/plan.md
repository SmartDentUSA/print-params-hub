## Auditoria do fluxo de leads — diagnóstico completo

Inspeção do banco e dos logs (últimas 24h, `system_health_logs` + `lia_attendances`) revela **3 bugs encadeados** que estão fazendo perder leads em escala. Não é só o caso da Ruani.

### Números atuais
- **82 leads** dos últimos 14 dias estão sem `piperun_id` (`merged_into IS NULL`, email válido, fora de teste).
- **74 desses 82** já têm o flag `piperun_retry_attempted_at` queimado — ou seja, o cron de retry **não vai mais tentar**.
- **`system_health_logs` de hoje** mostram dezenas de `crm_person_creation_failed` e o erro real do PipeRun: `"Não foi possível encontrar os campos customizados: ."` (HTTP 422).

### Bug #1 — RAIZ: `smart-ops-lia-assign` envia custom_fields inválidos ao criar Pessoa no PipeRun
O arquivo `_shared/piperun-hierarchy.ts` (versão consolidada) já documenta na linha 87:

> *"Pessoa custom field IDs 674001/674002 rejected by Piperun (422). Disabled."*

Mas a **versão duplicada** dentro de `supabase/functions/smart-ops-lia-assign/index.ts` (mesma função `findPersonByEmail` / `createPerson` que o plan.md antigo já mandou consolidar) continua enviando esses custom_fields no `POST /persons`. Resultado: PipeRun devolve 422, `personId=null`, `flowType=error_no_person`, **nenhum deal é criado**.

Ex: lead `2cc2f2f2…` (estampasdorei@gmail.com) — payload registrado em `system_health_logs`:
```json
{ "name": "Pedro Henrique",
  "emails": [{...}], "phones": [{...}],
  "custom_fields": [{"custom_field_id": 674001, "value": "Clínica ou Consultório"}],
  "origin_id": 801242 }
```
→ `422 Unprocessable Content` → lead sem PipeRun.

### Bug #2 — Cron `retry-failed-leads-15min` enterra leads em falha
`smart-ops-piperun-retry-failed-leads/index.ts` linha 94-97 carimba `piperun_retry_attempted_at` **independente do resultado** ("Mark attempt timestamp regardless of outcome — avoid hot loop"). Linha 59 do filtro descarta para sempre quem tem o flag. Então **uma única falha = lead enterrado**. Foi o que aconteceu com Ruani, Bernadete, Hugo, Otávio, Marcos e outros 69 leads.

### Bug #3 — `smart-ops-ingest-lead` dispara `lia-assign` em fire-and-forget sem `EdgeRuntime.waitUntil`
Linhas 488-502 e 505: `fetch(...).catch(console.warn)` sem `await` nem `waitUntil`. O Supabase Edge Runtime mata o request em-vôo quando o handler termina. Em ambiente carregado, a chamada nunca chega. Cobertura "salva-vidas" hoje seria o cron de retry — mas ele está quebrado pelo Bug #2.

### Bug #4 — Risco de mistura de leads (já documentado no `.lovable/plan.md` antigo)
A função local `findPersonByEmail` em `smart-ops-lia-assign/index.ts` linha 55 tem `|| items[0]` que pega "primeira pessoa qualquer" do PipeRun (caso "Heitor Rabeti" da Camila Rolim). A versão correta em `_shared/piperun-hierarchy.ts` já removeu isso, mas a duplicada continua viva.

### Bug #5 — Cron de retry não loga nada por lead
`smart-ops-piperun-retry-failed-leads` só imprime boot/shutdown. Sem `console.log` por candidato e sem `system_health_logs` em falha — fica invisível qual lead falhou e por quê.

---

## Plano de correção

### Parte 1 — Matar a duplicação em `lia-assign` (resolve Bugs #1 e #4)
- Em `supabase/functions/smart-ops-lia-assign/index.ts`: remover as funções locais `findPersonByEmail` e `createPerson`/`updatePersonFields` e importar de `_shared/piperun-hierarchy.ts` (que já está limpo dos `custom_fields` proibidos e do fallback `items[0]`).
- Conferir em `findOrCreateCompany` se ainda há custom_fields rejeitados pela Pessoa sendo enviados via `personPayload` em qualquer outro caminho.

### Parte 2 — Reformar o cron de retry (resolve Bugs #2 e #5)
Em `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts`:
- Trocar `piperun_retry_attempted_at` por contador `piperun_retry_attempts` + `piperun_retry_last_attempt_at` + `piperun_retry_last_error` (gravados **só após** chamar o assign).
- Em sucesso: continuar gravando `piperun_retry_succeeded_at` e zerar o contador.
- Filtro de candidatos: `attempts IS NULL OR (attempts < 6 AND now() - last_attempt_at >= base_backoff(attempts))` com backoff 15min/30min/1h/2h/4h/8h.
- Ao esgotar 6 tentativas: gravar `system_health_logs` com `error_type='piperun_assign_exhausted'` para o Copilot escalar.
- Logar cada candidato + outcome (`console.log` + `system_health_logs` em falha).
- Migration leve: índice parcial `(raw_payload->>'piperun_retry_attempts') WHERE merged_into IS NULL AND piperun_id IS NULL` para o cron escalar.

### Parte 3 — Tornar o dispatch confiável (resolve Bug #3)
Em `supabase/functions/smart-ops-ingest-lead/index.ts` linhas 488 e 505:
- Trocar `fetch(...).catch(...)` por `EdgeRuntime.waitUntil(fetch(...).catch(...))`. O runtime mantém o handler vivo até o fetch resolver.
- Aplicar idem nas linhas 388 (`smart-ops-deal-form-note`) e em `smart-ops-piperun-webhook/index.ts` 886 e 943 (`cognitive-lead-analysis`) e `smart-ops-wa-inbox-webhook/index.ts` 221, 297.
- Se falhar, gravar `system_health_logs` com `error_type='lia_assign_dispatch_failed'`.

### Parte 4 — Hardening do `lia-assign` para nunca corromper lead
No bloco "update lead in lia_attendances" (linhas 1623+):
- Quando `flowType === "error_no_person"`: **não** sobrescrever `proprietario_lead_crm`, `funil_entrada_crm`, `ultima_etapa_comercial` no banco. Apenas logar e sair, deixando o cron retry assumir.
- Hoje o código grava `funil_entrada_crm = "Funil de vendas"` mesmo quando a criação falhou, o que polui status downstream.

### Parte 5 — Reparo retroativo (one-shot)
Após Partes 1-3 estarem em produção:
1. SQL migration limpa: `UPDATE lia_attendances SET raw_payload = raw_payload - 'piperun_retry_attempted_at' WHERE merged_into IS NULL AND piperun_id IS NULL AND raw_payload ? 'piperun_retry_attempted_at';` (afeta os 74 leads enterrados).
2. Disparar `POST smart-ops-piperun-retry-failed-leads` com `{"limit":100,"lookback_days":14,"force":true}`. Os 82 leads (incluindo Ruani, Bernadete, Hugo, Otávio, Marcos, Ana Paula, Tamára…) são recriados no PipeRun com pessoa + deal.
3. Validar com `SELECT count(*) FROM lia_attendances WHERE merged_into IS NULL AND piperun_id IS NULL AND created_at > now() - interval '14 days' AND email IS NOT NULL AND email NOT ILIKE '%test%';` — deve cair para perto de zero (apenas leads dos últimos 5 minutos).

### Parte 6 — Monitoramento contínuo (preventivo)
- Adicionar query de health no dashboard Copilot: "Leads sem PipeRun > 30min" e "Leads com 3+ retries falhados". Alertar quando > 5 simultâneos.
- Cron `system-health-watchdog` (já existe) pode chamar essa query e notificar via WhatsApp.

### Arquivos alterados
1. `supabase/functions/smart-ops-lia-assign/index.ts` — remover duplicatas, importar de `_shared/piperun-hierarchy.ts`, parar de poluir lead em erro.
2. `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` — schema novo de flags + backoff + logs.
3. `supabase/functions/smart-ops-ingest-lead/index.ts` — `EdgeRuntime.waitUntil` em 3 fetches.
4. `supabase/functions/smart-ops-piperun-webhook/index.ts` — `waitUntil` em 2 fetches.
5. `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` — `waitUntil` em 2 fetches.
6. 1 migration: índice parcial + limpeza dos 74 flags queimados.

### Validação final
- Criar 1 lead de teste via `meta_lead_ads` simulado → `piperun_id` aparece em ≤30s, com Pessoa correta vinculada (não "Heitor Rabeti").
- Forçar 1 falha proposital (PipeRun com token inválido temporariamente) → cron retenta 6x com backoff e grava `piperun_assign_exhausted`, sem enterrar.
- Verificar que `funil_entrada_crm` permanece `null` enquanto não houver `piperun_id`.

### Perguntas
1. Posso já implementar **as 6 partes em sequência** (consolidação → cron → dispatch → hardening → reparo → monitoramento)? Ou prefere quebrar em 2 PRs (1: Partes 1-3 que são código + 2: Partes 4-6 incluindo backfill)?
2. Para a Parte 5 (backfill dos 82 leads), prefere `dry_run` primeiro com a lista para revisão, ou já libero direto (todos têm dados próprios — e-mail/telefone — não há risco de mistura porque o Bug #4 será corrigido antes)?