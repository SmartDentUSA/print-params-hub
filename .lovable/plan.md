# Endurecer o fluxo LIA: concorrência, merge e echo (v2 — com templates)

Plano aprovado pelo usuário com refinamentos de código. Execução em 3 frentes sequenciais. Frente 1 primeiro para aliviar imediatamente o gargalo de produção.

## Frente 1 — Isolar `cognitive-lead-analysis` de `lia_attendances`

**Problema:** `cognitive-lead-analysis` faz `UPDATE lia_attendances` async na mesma linha que o turno reescreve → lock-contention → timeout do turno.

### 1.1 Migration (schema)

```sql
-- Tabela de insights cognitivos (1:1 com lia_attendances)
CREATE TABLE public.lia_cognitive_insights (
    lead_id UUID PRIMARY KEY REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
    cognitive_summary TEXT,
    cognitive_score INT,
    cognitive_updated_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB DEFAULT '{}'::jsonb,
    version INT DEFAULT 1
);

ALTER TABLE public.lia_cognitive_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.lia_cognitive_insights
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service_role full access" ON public.lia_cognitive_insights
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- View enriquecida para consumidores (Copilot, Hero Card)
CREATE OR REPLACE VIEW public.vw_lia_attendances_enriched AS
SELECT a.*,
       c.cognitive_summary,
       c.cognitive_score,
       c.cognitive_updated_at AS insight_updated_at,
       c.payload AS cognitive_payload
FROM public.lia_attendances a
LEFT JOIN public.lia_cognitive_insights c ON a.id = c.lead_id;

-- Backfill incremental dos dados legados
INSERT INTO public.lia_cognitive_insights (lead_id, cognitive_summary, cognitive_updated_at)
SELECT id, cognitive_summary, cognitive_updated_at
FROM public.lia_attendances
WHERE cognitive_summary IS NOT NULL
ON CONFLICT (lead_id) DO NOTHING;

-- RPC para advisory lock por lead
CREATE OR REPLACE FUNCTION public.try_lock_cognitive_analysis(target_lead_id UUID)
RETURNS BOOLEAN AS $$
  SELECT pg_try_advisory_xact_lock(hashtext(target_lead_id::text));
$$ LANGUAGE sql;
```

Colunas `lia_attendances.cognitive_*` ficam `DEPRECATED` por 1 release (sem escrita nova). Removidas depois.

### 1.2 Edge function refactor

- `cognitive-lead-analysis/index.ts`: substituir `UPDATE lia_attendances SET cognitive_*` (linhas 387 e 433) por `UPSERT` em `lia_cognitive_insights`. Antes de tudo, chamar `supabase.rpc('try_lock_cognitive_analysis', { target_lead_id: leadId })`; se `false`, retorna `202 { status: 'skipped', reason: 'lock_contention' }` + insere `system_health_logs(event_type='cog_lock_skipped')`.
- `dra-lia/index.ts` (linha 1431): mantém fire-and-forget; só muda o destino de leitura/escrita interno.
- Consumidores que leem `cognitive_summary` (Copilot `get_lead_card`, Hero Card, qualquer query SQL) passam a usar `vw_lia_attendances_enriched`. Inventário de call-sites antes de remover as colunas.

## Frente 2 — Merge atômico e resolução canônica recursiva

**Problema:** `merged_into` pode ser preenchido antes da consolidação do histórico, e o filtro `WHERE merged_into IS NULL` quebra a sessão ativa.

### 2.1 Migration: RPC atômica

```sql
CREATE OR REPLACE FUNCTION public.merge_lia_attendances(source_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Lock ordenado para evitar deadlocks cruzados
    IF source_id < target_id THEN
        PERFORM id FROM public.lia_attendances WHERE id IN (source_id, target_id) FOR UPDATE;
    ELSE
        PERFORM id FROM public.lia_attendances WHERE id IN (target_id, source_id) FOR UPDATE;
    END IF;

    -- Consolidar identificadores no target (sem sobrescrever)
    UPDATE public.lia_attendances t
    SET email = COALESCE(t.email, s.email),
        phone = COALESCE(t.phone, s.phone),
        piperun_id = COALESCE(t.piperun_id, s.piperun_id),
        metadata = COALESCE(t.metadata,'{}'::jsonb) || COALESCE(s.metadata,'{}'::jsonb)
    FROM public.lia_attendances s
    WHERE t.id = target_id AND s.id = source_id;

    -- Reatribuir FKs (lista gerada dinamicamente na migration via information_schema)
    UPDATE public.agent_sessions      SET lead_id = target_id WHERE lead_id = source_id;
    UPDATE public.agent_interactions  SET lead_id = target_id WHERE lead_id = source_id;
    UPDATE public.whatsapp_inbox      SET lead_id = target_id WHERE lead_id = source_id;
    -- … demais FKs (deals, lead_page_views, tickets, etc.) inventariadas na migration

    -- Migrar insights cognitivos
    INSERT INTO public.lia_cognitive_insights (lead_id, cognitive_summary, cognitive_score, payload)
    SELECT target_id, cognitive_summary, cognitive_score, payload
    FROM public.lia_cognitive_insights WHERE lead_id = source_id
    ON CONFLICT (lead_id) DO UPDATE
       SET cognitive_summary = COALESCE(lia_cognitive_insights.cognitive_summary, EXCLUDED.cognitive_summary);
    DELETE FROM public.lia_cognitive_insights WHERE lead_id = source_id;

    -- Marcar merge POR ÚLTIMO
    UPDATE public.lia_attendances
       SET merged_into = target_id, merged_at = NOW()
     WHERE id = source_id;

    INSERT INTO public.system_health_logs (event_type, details)
    VALUES ('merge_rpc_calls', jsonb_build_object('source', source_id, 'target', target_id));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Refactor dos call-sites de merge

Substituir todo `update({ merged_into })` por `supabase.rpc('merge_lia_attendances', { source_id, target_id })`. Auditar: `dra-lia/index.ts` (linhas 2312-2352), `smart-ops-lia-assign`, `smart-ops-ingest-lead`, `smart-ops-sync-piperun`, `piperun-person-contact-backfill`, `omie-lead-enricher`.

### 2.3 Helper `resolveCanonicalLead`

Em `_shared/identity-utils.ts`, expor:

```ts
export async function resolveCanonicalLead(supabase: any, currentId: string, maxDepth = 5): Promise<string> {
  let activeId = currentId;
  for (let i = 0; i < maxDepth; i++) {
    const { data } = await supabase
      .from('lia_attendances')
      .select('id, merged_into')
      .eq('id', activeId)
      .single();
    if (!data) break;
    if (!data.merged_into) return data.id;
    activeId = data.merged_into;
  }
  return activeId;
}
```

`dra-lia` e `dra-lia-whatsapp` deixam de usar `.is('merged_into', null)` na resolução do lead corrente e passam a chamar `resolveCanonicalLead` após localizar o lead por email/phone. Isso elimina "sessão fantasma" durante merge.

## Frente 3 — Echo guard por message ID

**Problema:** echo-guard só conhece texto; sob delay da Evolution a outbound ainda não está em `whatsapp_inbox` e o eco passa. Mensagens curtas geram falso positivo no futuro.

### 3.1 Migration

```sql
ALTER TABLE public.whatsapp_inbox ADD COLUMN wa_message_id TEXT;
CREATE UNIQUE INDEX idx_unique_wa_message_id_outbound
  ON public.whatsapp_inbox(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE TABLE public.wa_outbound_pending (
    wa_message_id TEXT PRIMARY KEY,
    phone_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wa_outbound_pending_phone ON public.wa_outbound_pending(phone_normalized);

ALTER TABLE public.wa_outbound_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.wa_outbound_pending
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Job pg_cron a cada 1 min: `DELETE FROM wa_outbound_pending WHERE created_at < NOW() - INTERVAL '60 seconds';`

### 3.2 `smart-ops-send-waleads` (nova ordem)

1. Gerar/obter `wa_message_id` antes do envio.
2. `INSERT wa_outbound_pending`.
3. `fetch` para Evolution.
4. Em sucesso → `INSERT whatsapp_inbox(... wa_message_id)` e `DELETE wa_outbound_pending WHERE wa_message_id = …`.
5. Em erro → manter pending para o TTL expirar.

### 3.3 `dra-lia-whatsapp/index.ts` echo guard

Fluxo:

```text
Webhook → extrai key.id
       → SELECT 1 FROM wa_outbound_pending WHERE wa_message_id = ?  →  ignore: echo_by_id_pending
       → SELECT 1 FROM whatsapp_inbox WHERE wa_message_id = ? AND direction='outbound' → ignore: echo_by_id_stored
       → Fallback texto (atual) APENAS se body.fromMe === true OU match EXATO (remover regra de prefix) → echo_by_text_fallback
       → senão → processa turno
```

Atualizar `echo-guard_test.ts` com:
- (a) eco detectado por ID pending,
- (b) eco detectado por ID stored,
- (c) "ok" inbound NÃO dispara eco sem id correspondente,
- (d) prefix-only deixa de bloquear (regressão intencional do comportamento atual).

Logar `system_health_logs(event_type='echo_by_id' | 'echo_by_text_fallback')` para medir conversão.

## Ordem de execução

1. **Frente 1** (alívio imediato): migration + refactor cognitive-lead-analysis + ajuste consumidores da view.
2. **Frente 2**: RPC merge + helper canônico + refactor call-sites.
3. **Frente 3**: schema WA + send-waleads + echo guard + testes Deno.
4. **Validação** (query padrão):

```sql
SELECT event_type, count(*) AS ocorrencias, min(created_at) AS monitorado_desde
FROM public.system_health_logs
WHERE event_type IN ('cog_lock_skipped','merge_rpc_calls','echo_by_id','echo_by_text_fallback')
GROUP BY event_type;
```

5. Atualizar memórias do projeto:
   - `mem://architecture/cognitive-insights-isolation` (Frente 1)
   - `mem://architecture/merge-atomic-rpc-and-canonical-resolution` (Frente 2)
   - `mem://architecture/whatsapp-echo-guard-by-id` (Frente 3)
   - Ajustar Core: filtro `merged_into IS NULL` agora opcional quando se usa `resolveCanonicalLead`.

## Fora de escopo

- Rewrite do `summarize_session` (etapa 7 do `dra-lia`).
- Mudança de provedor WhatsApp (já em transição).
- Limpeza histórica de `merged_into` órfãos.
- Remoção das colunas `lia_attendances.cognitive_*` (fica para release seguinte, após período DEPRECATED).
