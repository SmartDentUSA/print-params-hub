## Diagnóstico

Marlucio Teixeira tem **9 deals** no PipeRun em 14 dias, todos com origem na mesma campanha (FACE - BLZ INO110 PLUS). Investigação no Supabase:

- **Lead canônico único** (`2ed33065-...`), `pessoa_piperun_id=47281340`, sem `merged_into`.
- Em **22/06 01:48** o sistema corretamente preservou o deal `#61211826` (open VENDAS, C2) — fluxo `preserve_vendas`.
- Em **24/06 14:45:38** o sistema **criou novo deal `#61292896`** mesmo com `#61211826` ainda aberto em VENDAS. A partir daí, o "novo" deal virou canônico e o antigo passou a aparecer como `vendas_duplicates_detected_noop` + `duplicate_deal_quarantined` — não fechado (pipeline protegido).

### Por que a Regra de Ouro falhou no momento exato da criação

A Regra de Ouro depende em cadeia de 3 defesas, todas baseadas em `findPersonDeals(personId)`:

1. `vendaDeal = openDeals.find(d => pipeline_id===VENDAS && !d.freezed)` → preserva.
2. `golden_rule_primary` (last 30d).
3. `assertCanCreateNewDeal` universal gate.

**Todas as três defesas dependem da MESMA chamada PipeRun** (`GET /deals?person_id=X&show=50`). Se essa chamada retorna `[]` por qualquer motivo (timeout, 5xx, blip de rede, `freezed=true` em todos os deals, cache stale), `vendaDeal=undefined` → todas as 3 defesas se tornam no-op → `createNewDeal` POST roda. `findPersonDeals` engole erros silenciosamente (`return []`).

Há ainda o `DEDUPE GUARD` no L3001 que olha `lead.piperun_id` cacheado — mas só roda quando `piperunId` (variável local) **já é falsy**. Como `piperunId` é inicializado em L2657 a partir de `lead.piperun_id`, se este já estiver setado (caso normal), o `DEDUPE GUARD` é pulado. E se o `lead.piperun_id` estiver setado mas o deal cacheado tiver sido **fechado/movido** no PipeRun por um vendedor, esse caminho cria deal novo também.

### Família-dedupe (ingest-lead) tem buraco
Marlucio enviou DOIS formulários Meta distintos ("+ NOTEBOOK" e "somente scanner") — `platform_form_id` diferentes. O `FAMILY-KEY DEDUPE` casa apenas quando **mesmo `platform_form_id` + mesmo email/phone** já existir em `lia_attendances`. Em submissão de um form_id novo, family-dedupe não casa → `lia-assign` é chamado em modo normal → cai na cadeia de 3 defesas acima.

## Plano — Trava de última milha (defense-in-depth)

O objetivo é tornar a Regra de Ouro **independente** de qualquer resposta do PipeRun e **idempotente sob concorrência**. Três camadas adicionais, **ortogonais** às existentes (não removem nada).

### 1. Trava atômica por lead (DB-level lock) — pré-`createNewDeal`

Nova tabela `smartops_golden_rule_deal_locks`:

```
lead_id          uuid PRIMARY KEY
acquired_at      timestamptz NOT NULL DEFAULT now()
expires_at       timestamptz NOT NULL          -- now() + 5 min
person_id        bigint
intent_hash      text                          -- hash(form_name + source) p/ debug
```

RPC `try_claim_deal_create_slot(_lead_id uuid, _person_id bigint, _intent_hash text, _ttl_seconds int)` faz `INSERT ... ON CONFLICT (lead_id) DO UPDATE WHERE expires_at < now() RETURNING (xmax = 0)` — devolve `true` só se conseguiu inserir/expirar. Caso `false` → outra execução já está criando, abortar com `flow_type=concurrent_create_lock_held`.

Esse RPC é chamado em `smart-ops-lia-assign/index.ts` **imediatamente antes** do `createNewDeal` no L3069 (universal gate path) e no L1857 (SDR-Captação path). Lock é liberado em `try/finally` no final do request com `DELETE WHERE lead_id=$1`.

### 2. Re-fetch fresh `lead.piperun_id` no último passo

Antes do `createNewDeal` no L3069, fazer um `SELECT piperun_id, pessoa_piperun_id FROM lia_attendances WHERE id=$lead_id` **fresh** (não usar a `lead` carregada no L2332, que pode estar stale por minutos). Se `piperun_id` voltou setado e o deal correspondente **ainda está aberto em VENDAS** (`GET /deals/{id}`), preservar e abortar criação. Isso fecha a janela de race entre múltiplas chamadas concorrentes ao `lia-assign`.

### 3. Fail-safe em `findPersonDeals`: tratar erro/lista vazia com `lead.piperun_id` setado como bloqueio

Em `findPersonDeals` (L644), distinguir **`{ deals: [...], fetched_ok: true }`** vs **`{ deals: [], fetched_ok: false }`**. Atualizar o callsite L2823 para:

- Se `fetched_ok===false` E `lead.piperun_id` é truthy → **NÃO criar deal novo**. Apenas preservar `piperunId = lead.piperun_id`, marcar `flow_type=preserve_cached_on_piperun_fetch_failure`, registrar `system_health_logs` com severity=`warning`, e prosseguir só com enrichment do deal cacheado.
- Se `fetched_ok===false` E `lead.piperun_id` é null → **abortar** com 503 e enfileirar retry (`crm_creation_blocked='piperun_fetch_failed'`).

Isso elimina a falha silenciosa que provavelmente causou o caso Marlucio.

### 4. Atualização da memória de arquitetura

Atualizar `mem://architecture/golden-rule-primary-flow`:
- Adicionar: "Toda criação de Deal VENDAS exige claim atômico em `smartops_golden_rule_deal_locks` (TTL 5 min) + revalidação fresh de `lead.piperun_id` imediatamente antes do POST. `findPersonDeals` que falha NÃO permite criação se `lead.piperun_id` está setado."

## Fora de escopo

- Não alterar a tabela `lia_attendances`.
- Não mexer em `wa-*`, `smart-ops-piperun-webhook`, `cognitive-*`, ou qualquer fluxo de envio.
- Não reabrir/consolidar os deals já criados (#60297093, #60825418, #61032372..#61292896). Esses ficam por conta do trabalho manual do time — a tarefa é **parar a sangria daqui pra frente**.
- Não mudar a regra de family-dedupe (alterar isso afeta detecção de re-entregas Meta, que está funcionando bem hoje).

## Detalhes técnicos (referência)

```
supabase/migrations/<ts>_golden_rule_deal_create_lock.sql
  - CREATE TABLE smartops_golden_rule_deal_locks
  - GRANTs (service_role only)
  - RLS enabled, no policies (service_role bypasses)
  - CREATE FUNCTION try_claim_deal_create_slot(...)
  - CREATE FUNCTION release_deal_create_slot(_lead_id uuid)

supabase/functions/_shared/golden-rule-guard.ts
  - export claimDealCreateSlot(supabase, leadId, personId, intentHash)
  - export releaseDealCreateSlot(supabase, leadId)

supabase/functions/smart-ops-lia-assign/index.ts
  - L644 findPersonDeals → retornar { deals, fetched_ok }
  - L2823 callsite → respeitar fetched_ok===false
  - L1857 e L3069 → wrap em claim/release
  - L3069 → re-SELECT fresh lead.piperun_id antes do POST
```