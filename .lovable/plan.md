
## Diagnóstico

A função cron **`meta-lead-ads-pull`** (`*/2 * * * *`, `since_minutes=3`) está reentregando os mesmos `leadgen_id`s do Meta a cada execução e, para 3 leads já existentes em "Funil de vendas", entra no branch **REATIVADO** e chama `smart-ops-lia-assign` de novo. Logs (22:38→22:48):

```
REATIVADO: tatitessarini17@gmail.com estava em pipeline=Funil de vendas
REATIVADO: celiosousa2@hotmail.com  estava em pipeline=Funil de vendas
REATIVADO: miguel.alm34@hotmail.com estava em pipeline=Funil de vendas
```

Cada lead aparece com **2 leadgen_ids ping-pong** (formulários gêmeos "BLZ- Smart Dent" e "# - FACE - INTRAORAL MEDIT") → 6 invocações de lia-assign a cada 2 min → 6 inserts em `lead_activity_log (event_type='seller_assigned')`. Em 10 h são ~1.800 eventos de ruído.

Por que os guards existentes não pegam:
- `smart-ops-ingest-lead` HARD_DEDUPE + FAMILY_KEY + REDELIVERY_GUARD funcionam, mas **`meta-lead-ads-pull` NÃO passa por ingest-lead** no caminho "reativado" — chama lia-assign direto.
- Idempotency em lia-assign (`piperun_id && updated_at < 3min`) falha porque a re-execução leva 10 s e a janela de 3 min nunca expira, mas o `updated_at` é re-escrito pelo próprio pipeline (GOLDEN RULE limpa `proprietario_lead_crm` transitoriamente), então a guard sempre vê o lead "antigo" e roda o pipeline inteiro.
- Tatianna está com `platform_lead_id=NULL` e `platform_form_id=NULL` no CDP → mesmo se ingest-lead fosse chamado, nenhum dos dedupes funcionaria.

## Plano

### Parte 1 — Recuperar `meta-lead-ads-pull` para o repo

A função está deployada como `v13` mas não existe em `supabase/functions/`. Vou recriar o arquivo a partir do contrato observado (logs + tabela `lia_attendances` columns) e aplicar os patches diretamente.

### Parte 2 — Guard novo em `meta-lead-ads-pull` (branch REATIVADO)

Antes de despachar lia-assign:

```ts
// Skip total se o lead canônico já está em Funil de Vendas (18784)
// e foi atualizado nas últimas 24h. Re-entregas Meta NUNCA reativam
// um lead que já está num funil comercial ativo.
if (canonicalLead.piperun_pipeline_id === 18784
    && new Date(canonicalLead.updated_at) > Date.now() - 24*3600*1000) {
  // arquivar novo leadgen_id em previous_platform_lead_ids e sair
  await archiveLeadgenId(canonicalLead.id, leadgenId);
  log("META_PULL_SKIP_ACTIVE_VENDAS", { email, leadgenId, lead_id: canonicalLead.id });
  continue;
}
```

Também aplicar **HARD_DEDUPE por leadgen_id** (mesma query usada em ingest-lead L86) antes de qualquer side-effect.

### Parte 3 — Reforçar idempotency em `smart-ops-lia-assign`

Em `~L1842`, mudar a guarda de:
- `piperun_id && updated_at < 3min`

para também aceitar:
- `piperun_pipeline_id = 18784 && trigger ∈ ['meta_pull','meta_pull_reactivation'] && exists seller_assigned event nas últimas 6h`

Isso protege independentemente de quem chamou (meta-pull, retry-cron, etc).

### Parte 4 — Backfill defensivo dos 3 leads

```sql
-- 1. Arquivar todos os leadgen_ids vistos em previous_platform_lead_ids
UPDATE lia_attendances
SET raw_payload = jsonb_set(
  COALESCE(raw_payload,'{}'::jsonb),
  '{previous_platform_lead_ids}',
  to_jsonb(ARRAY[
    '1309468353919888','1852019002160386','994460442184175',
    '2074883396422916','2221100968425819','9999999999999999','7777777777777777','1853424102139156',
    '1695326341666157','2212633665940663'
  ])
)
WHERE id IN ('33c5006c-...','543af551-...','42dcab5c-...');

-- 2. Preencher platform_form_id em Tatianna (estava NULL)
UPDATE lia_attendances
SET platform_form_id = '1853424102139156',  -- inferir do log mais comum
    platform_lead_id  = COALESCE(platform_lead_id, '2212633665940663')
WHERE id = '33c5006c-...';
```

### Parte 5 — Limpeza dos eventos-ruído

```sql
-- Apagar seller_assigned redundantes (>1 por lead nas últimas 24h)
DELETE FROM lead_activity_log
WHERE event_type = 'seller_assigned'
  AND lead_id IN ('33c5006c-...','543af551-...','42dcab5c-...')
  AND event_timestamp > now() - interval '24 hours'
  AND id NOT IN (
    SELECT DISTINCT ON (lead_id) id FROM lead_activity_log
    WHERE event_type='seller_assigned'
      AND lead_id IN ('33c5006c-...','543af551-...','42dcab5c-...')
      AND event_timestamp > now() - interval '24 hours'
    ORDER BY lead_id, event_timestamp ASC
  );
```

### Parte 6 — Memória nova

Atualizar `mem/architecture/meta-redelivery-loop-fix.md` com a 5ª camada (`META_PULL_SKIP_ACTIVE_VENDAS`) e adicionar regra **Core** no `mem/index.md`:

> Leads em `piperun_pipeline_id=18784` (Vendas) NUNCA são reativados por `meta-lead-ads-pull` — re-entrega Meta apenas arquiva o novo leadgen_id.

## Arquivos a tocar

- `supabase/functions/meta-lead-ads-pull/index.ts` *(recriar a partir do deploy + adicionar guards)*
- `supabase/functions/smart-ops-lia-assign/index.ts` *(reforçar idempotency ~L1842)*
- `supabase/migrations/{ts}_kill_meta_redelivery_loop.sql` *(backfill + limpeza)*
- `mem/architecture/meta-redelivery-loop-fix.md` *(adicionar 5ª camada)*
- `mem/index.md` *(regra Core nova)*

## Validação pós-deploy

1. Aguardar próximo tick de meta-lead-ads-pull (≤2 min).
2. Verificar logs: deve aparecer `META_PULL_SKIP_ACTIVE_VENDAS` para tatitessarini/celiosousa/miguel.alm34.
3. SQL: `select count(*) from lead_activity_log where event_type='seller_assigned' and event_timestamp > now() - interval '5 min'` deve ser ≈ 0 (apenas novos leads reais).
4. `SmartOpsLogs › Log de Chegada` no /admin deve parar de mostrar a sequência repetida.
