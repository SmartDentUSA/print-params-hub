## Diagnóstico

O loop de eventos "Negócio criado" + "seller assigned" a cada 2 min (Luciana Boggian, Hugo Roberto, Moacir Franzoi, etc., todos com o **mesmo `piperun_id` 60027321** repetido) tem duas causas que se combinam.

### Causa 1 — `force_new_deal=true` em TODA submissão (`smart-ops-ingest-lead`)

`supabase/functions/smart-ops-ingest-lead/index.ts:955-964` dispara `smart-ops-lia-assign` com:

```ts
force_new_deal:
  payload.force_new_deal === true ||
  (typeof formName === "string" && formName.trim().length > 0) ||  // ← qualquer form
  (source === "loja_integrada" && ...)
```

Resultado: **qualquer formulário Meta (mesmo re-entrega/oscilação)** força `lia-assign` a ignorar a idempotência e reexecutar todo o fluxo PipeRun (Person/Company/Deal + republish de contatos). Os logs `system_health_logs` confirmam `person_resolution_trace` + `piperun_person_contact_published` para a mesma lead a cada 2 min, alternando entre os dois `form_name`. Como esses leads já estão em **Funil de Vendas** com deal aberto (60027321), `lia-assign` cai no `GOLDEN RULE`/`DEDUPE GUARD` e simplesmente regrava `piperun_id`/`proprietario_lead_crm` com os MESMOS valores.

### Causa 2 — Trigger `fn_log_form_submission_to_timeline` sem janela de dedupe para `deal_created`/`seller_assigned`

`supabase/migrations/20260521225322_*.sql:73-126`:

```sql
IF TG_OP='UPDATE' AND OLD.piperun_id IS NULL AND NEW.piperun_id IS NOT NULL THEN
   INSERT INTO lead_activity_log (... 'deal_created' ...)  -- sem dedupe
END IF;
```

O branch `form_submission` já tem guard de 24 h (`v_recent_exists`). Os branches `deal_created` e `seller_assigned` **não têm**. Quando `lia-assign` (ou qualquer outro caminho — `sync-piperun`, `crm-sync-concurrency-lock`, retentativas) faz um UPDATE em que `OLD.piperun_id` é momentaneamente NULL (ex.: rota `shouldForceNewDeal` em ingest-lead linha 589-606, `clearMergedLeadUniqueKeys`, race em retry-cron), o trigger insere uma linha nova. Como `force_new_deal` está sendo disparado a cada 2 min, qualquer brecha em que `piperun_id` cai para NULL antes de voltar a 60027321 reabre o ciclo. O resultado visível: a timeline acumula `deal_created` para o mesmo `piperun_id` indefinidamente.

## Plano de correção

### 1. Trigger SQL — adicionar dedupe de 24h em `deal_created` e `seller_assigned`

Nova migração reescrevendo `fn_log_form_submission_to_timeline` para que os dois branches sigam o mesmo padrão do `form_submission`:

```sql
-- deal_created
IF TG_OP='UPDATE' AND OLD.piperun_id IS DISTINCT FROM NEW.piperun_id
   AND NEW.piperun_id IS NOT NULL THEN
  SELECT EXISTS (
    SELECT 1 FROM lead_activity_log
    WHERE lead_id = NEW.id
      AND event_type = 'deal_created'
      AND COALESCE(event_data->>'piperun_id','') = NEW.piperun_id::text
      AND event_timestamp >= now() - interval '24 hours'
  ) INTO v_recent_exists;
  IF NOT v_recent_exists THEN INSERT ... END IF;
END IF;

-- seller_assigned (mesma forma, dedupe por vendedor + 24h)
```

Trocar `OLD.piperun_id IS NULL` por `IS DISTINCT FROM` torna o trigger robusto à oscilação NULL↔valor e a transições entre dois deals diferentes, mantendo a semântica "loga quando muda".

### 2. Limpeza one-shot de eventos duplicados

Na mesma migração: para `event_type IN ('deal_created','seller_assigned')`, manter apenas a primeira ocorrência por `(lead_id, event_type, COALESCE(event_data->>'piperun_id', entity_name), event_timestamp::date)` e deletar o resto. Mesma estratégia da limpeza que já existe para `form_submission` no fim da migração `20260521225322`.

### 3. `smart-ops-ingest-lead` — parar de pedir `force_new_deal` em toda submissão

Em `index.ts:955-964`, restringir o gatilho de `force_new_deal` ao que realmente justifica criar um novo Deal:

- manter `payload.force_new_deal === true` (uso explícito);
- manter o ramo `loja_integrada` (consulta de produto = oportunidade nova);
- **remover** a regra "qualquer `form_name` ⇒ novo deal". A lógica `shouldForceNewDeal` que JÁ existe na linha 583-606 cobre o caso correto: se o lead **não** está em Funil de Vendas, zera `piperun_id` localmente e deixa `lia-assign` criar o deal novo. Para leads já em Vendas com deal aberto, o caminho idempotente do `lia-assign` (early-return em `index.ts:1842`) deve prevalecer.

Isso elimina o disparo a cada re-entrega Meta para leads já vinculados.

### 4. Verificação pós-deploy

- Conferir em `lead_activity_log` que o lead `04f7e07e-...` (Luciana) para de receber novos `deal_created` mesmo quando novas submissões Meta chegam.
- Conferir em `system_health_logs` que a frequência de `person_resolution_trace` para o mesmo `lead_id` cai (deve passar a só rodar em casos legítimos: nova submissão de lead novo, novo deal, recuperação de estagnado).
- Conferir que nada que dependa de `deal_created`/`seller_assigned` (Smart Ops timeline UI, métricas, KanbanLeadDetail) perde funcionalidade — passa a refletir o evento real, não o ruído.

## Detalhes técnicos

Arquivos tocados:

- **Nova migração** `supabase/migrations/<timestamp>_dedupe_deal_created_seller_assigned.sql`:
  - `CREATE OR REPLACE FUNCTION public.fn_log_form_submission_to_timeline` com janela de 24h nos dois branches e `IS DISTINCT FROM` em vez de `IS NULL`.
  - `DELETE` one-shot dos duplicados existentes em `lead_activity_log` para `deal_created` e `seller_assigned`.
- `supabase/functions/smart-ops-ingest-lead/index.ts`:
  - remover a cláusula `(typeof formName === "string" && formName.trim().length > 0)` do cálculo de `force_new_deal`.

Itens NÃO alterados:

- `smart-ops-lia-assign`: já tem `GOLDEN RULE`, `DEDUPE GUARD` e early-return idempotente; basta deixar de receber `force_new_deal` indevido.
- `smart-ops-piperun-webhook`: usa eventos `crm_deal_*` (não `deal_created`), não afetado.
- `piperun_deals_history` / enrichment offline em andamento: independente.
