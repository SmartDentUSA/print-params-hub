## Refinos pós-Frente 1: nomenclatura, cache canônico, lock hygiene e janela DeepSeek

Quatro ajustes finos cirúrgicos, baseados nas observações A–C e nos próximos passos. Cada um é isolado e pode entrar como hotfix sem tocar o núcleo do `dra-lia`.

---

### Ajuste 1 — Renomear tag `sem_interesse` no fluxo Hot-Lead (WhatsApp)

**Problema:** `smart-ops-lia-assign` dispara `Hot-lead Alert` e, no mesmo branch, aplica tag `sem_interesse`. Contradição semântica que polui dashboards de RFM/Intelligence Score e confunde SDR.

**Investigação prévia (antes de patch):**
- Mapear todos call-sites de `sem_interesse` (tag em `lia_attendances.tags` / `crm_tags`).
- Confirmar se a tag atual é "lead caiu em hot-alert e ainda não foi tocado por humano" (aguardando_humano) **ou** "engine classificou como sem fit" (na verdade `sem_fit`).
- Auditar Copilot tools (`query_leads`, RFM rules) que filtram por essa tag.

**Decisão proposta:** trocar para `aguardando_humano` quando vier de hot-alert. Manter `sem_interesse` apenas quando vier explicitamente da classificação cognitiva como rejeição.

**Patch:**
- `smart-ops-lia-assign/index.ts`: separar dois branches de tag (`hotAlertTag = 'aguardando_humano'`, `cognitiveRejectionTag = 'sem_interesse'`).
- Migration de dados: reclassificar leads históricos com `sem_interesse` aplicado em janela de hot-alert (heurística: tag aplicada nos últimos 60s após `hot_lead_alert_sent_at`) → `aguardando_humano`.
- Atualizar `mem://smart-ops/lead-card-business-intelligence-tables-v4` e regras RFM se filtrarem por essa tag.

---

### Ajuste 2 — Cache do `resolveCanonicalLead` (preventivo)

**Problema:** chamada síncrona a cada inbound WA escala mal sob >50 msg/s. Hoje aguenta, mas evita refactor futuro.

**Solução leve (sem Redis):**
- Cache em memória LRU dentro do worker da edge function (`Map<phone_digits, {canonicalId, expiresAt}>`, TTL 30s, max 500 entradas).
- Invalida no commit do `merge_lia_attendances` (publica em canal Postgres `pg_notify('canonical_invalidate', source_id)`, edge subscribe via realtime).
- Métrica: `system_health_logs(event_type='canonical_cache_hit' | 'canonical_cache_miss')`.

**Arquivo:** `_shared/identity-utils.ts` → adicionar `resolveCanonicalLeadCached(supabase, phoneOrId)`. Manter `resolveCanonicalLead` raw como fallback/debug.

**Escopo mínimo aceitável:** se o usuário não quiser invest agora, só instrumentar latência (`p50/p95` de `resolveCanonicalLead`) em `system_health_logs` para decidir depois.

---

### Ajuste 3 — Lock hygiene em `cognitive-lead-analysis`

**Problema:** `pg_try_advisory_xact_lock` libera no commit/rollback, mas o `try/finally` da edge function não garante que a transação fecha em erro não capturado (ex: timeout DeepSeek mata o worker).

**Patch:**
- Trocar `pg_try_advisory_xact_lock` por `pg_try_advisory_lock` + `pg_advisory_unlock` explícito em `finally`.
- Wrap toda lógica pós-lock em `try { ... } finally { await supabase.rpc('release_cognitive_analysis_lock', { target_lead_id }); }`.
- Migration: criar `release_cognitive_analysis_lock(uuid)` que chama `pg_advisory_unlock(hashtext(uuid::text))`.
- Garantir que o lock não vaza entre invocações da mesma worker (Deno reusa conexões).

**Risco:** se a worker morrer **antes** do `finally`, o lock fica órfão. Mitigação: TTL implícito via reinicialização do pool de conexões Supabase (~minutos). Adicionar job `cleanup_orphan_advisory_locks` opcional rodando a cada 5min.

---

### Ajuste 4 — Janela de contexto DeepSeek

**Problema:** prompt já tem smart-truncation > 4000 chars, mas histórico cresce O(n) com `agent_interactions`. Latência sobe com leads de 50+ turnos.

**Patch em `dra-lia/index.ts` (etapa de montagem do prompt):**
- Limitar `agent_interactions` carregadas: `LIMIT 15 ORDER BY created_at DESC` (hoje pega tudo da sessão).
- Manter system prompt + últimas 15 mensagens (~ 7-8 turnos U/A) + resumo cognitivo (`lia_cognitive_insights.cognitive_summary`) como "memória longa".
- Quando truncar, prefixar: `[Resumo das interações anteriores: <cognitive_summary>]`.
- Flag de tuning: `DRA_LIA_HISTORY_WINDOW` env var (default 15) para ajustar sem deploy.

**Métrica:** logar `prompt_messages_count` e `prompt_chars` em `system_health_logs` para validar redução de p95.

---

### Ordem de execução proposta

1. **Ajuste 4** (DeepSeek window) — quick win, sem migration, impacto imediato em latência.
2. **Ajuste 3** (lock hygiene) — migration + refactor isolado em `cognitive-lead-analysis`.
3. **Ajuste 1** (tag rename) — requer alinhamento de regra de negócio antes (ver pergunta abaixo).
4. **Ajuste 2** (cache canônico) — só se métrica do Ajuste 3 (`canonical_cache_miss` latency) justificar. Apenas instrumentação primeiro.

### Fora de escopo
- Frentes 2 e 3 originais (merge RPC + echo by ID) — continuam pendentes, plano anterior em `.lovable/plan.md`.
- Redis real (overkill para volume atual).
- Remoção das colunas `lia_attendances.cognitive_*`.

### Pergunta de bloqueio (Ajuste 1)
Confirme a regra de negócio antes de eu codar:
- **Opção A:** `aguardando_humano` para hot-alert WA, `sem_interesse` só para rejeição cognitiva explícita (proposto).
- **Opção B:** `comercial_alta_prioridade` para hot-alert, `sem_interesse` mantido onde está (sem reclassificar histórico).
- **Opção C:** manter como está, é intencional (qual a lógica?).
