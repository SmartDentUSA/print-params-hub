## Objetivo

Aplicar a régua do Funil de Vendas no dedupe `meta_form_history_12h` (`smart-ops-ingest-lead/index.ts`), espelhando exatamente o comportamento de **SDR-CAPTAÇÃO reativação** (`smart-ops-lia-assign/index.ts:1700-1760`):

1. **Open deal em VENDAS (18784)** → apenas `updateExistingDeal` (custom fields + nota de re-entrega). Owner intacto (GOLDEN RULE).
2. **Open deals em qualquer outro funil** (Estagnados, Distribuidor, Insumos, Atos, E-book, etc.) → fechar cada um como **Perdido** (`status=2, lost_reason="reativacao_redelivery_meta"`) + **Fresh Round Robin** + `createNewDeal` em VENDAS / SEM_CONTATO.
3. **Nenhum deal aberto** → Fresh Round Robin + `createNewDeal` em VENDAS / SEM_CONTATO.
4. **Won deals** → NUNCA tocar (alinha com linha 2244).
5. **Sem `pessoa_piperun_id`** → abortar route, log `route_skipped: missing_person`.

Histórico preservado: deals antigos viram "Perdido por reativação" em vez de sumirem; `piperun_deals_history` e contagem total intactos.

## Por que muda

Hoje o dedupe `meta_form_history_12h` retorna `duplicate_skipped` antes de qualquer chamada PipeRun. Resultado: redelivery Meta de lead reaquecido **nunca** dispara régua comercial → vendedor perde a oportunidade fresca.

## Arquitetura — invocar lia-assign em modo restrito

Reusar toda a régua que já vive em `smart-ops-lia-assign` via nova flag `enrichment_only_route_deal: true`. Evita duplicar 150+ linhas (owner resolution, blocked-seller fallback, deal-note, snapshot, sanitizer, etc.).

## Mudanças

### 1. `supabase/functions/smart-ops-ingest-lead/index.ts` (~25 linhas)

No bloco `if (priorForm)`, **depois** do `update(updates)` e **antes** do `return duplicate_skipped`:

```ts
let dealRouteResult: Record<string, unknown> | null = null;
if (existingLead.pessoa_piperun_id && source === "meta_lead_ads" && formName) {
  try {
    const { data } = await supabase.functions.invoke("smart-ops-lia-assign", {
      body: {
        lead_id: existingLead.id,
        enrichment_only_route_deal: true,
        trigger_source: "meta_form_history_dedupe",
        form_name: formName,
        enriched_fields: enrichedFields,
      },
    });
    dealRouteResult = data ?? null;
  } catch (e) {
    console.warn("[ingest-lead] deal-route invoke failed:", e);
  }
}
```

Incluir `deal_route_result` no `system_health_logs.details` e no response JSON.

### 2. `supabase/functions/smart-ops-lia-assign/index.ts` (~80 linhas)

**No parse do body:**
```ts
const enrichmentOnlyRouteDeal = payload.enrichment_only_route_deal === true;
const enrichmentFormName = payload.form_name as string | null;
const enrichmentFields = (payload.enriched_fields as string[]) || [];
```

**Antes do bloco principal de Round Robin**, branch dedicado:

```ts
if (enrichmentOnlyRouteDeal) {
  // 1. Resolver lead, personId, companyId direto do banco (sem findPersonByEmail)
  const personId = lead.pessoa_piperun_id;
  const companyId = lead.empresa_piperun_id ?? null;
  if (!personId) {
    return json({ flow_type: "route_skipped", reason: "missing_person" });
  }

  // 2. Buscar TODOS deals da pessoa
  const allDeals = await findPersonDeals(PIPERUN_API_KEY, personId);
  const openDeals = allDeals.filter(d => Number(d.status) === 0);
  const vendaDeal = openDeals.find(d => Number(d.pipeline_id) === PIPELINES.VENDAS && !d.freezed);
  const otherOpenDeals = openDeals.filter(d => Number(d.pipeline_id) !== PIPELINES.VENDAS);

  const customFields = mapAttendanceToDealCustomFields(lead);
  // (fallback WHATSAPP idêntico ao SDR-CAPTAÇÃO)

  // 3a. VENDAS aberto → preservar + nota curta
  if (vendaDeal) {
    const dealOwnerId = Number(vendaDeal.owner_id);
    if (isBlockedSeller({ ownerId: dealOwnerId, ownerName: PIPERUN_USERS[dealOwnerId]?.name })) {
      // mover pra Distribuidor (reusa bloco 2289-2304)
    } else {
      await updateExistingDeal(PIPERUN_API_KEY, Number(vendaDeal.id), null, customFields, lead, companyId, supabase, []);
      await addDealNote(PIPERUN_API_KEY, Number(vendaDeal.id),
        `🔁 [Dra. L.I.A.] Re-entrega Meta (form "${enrichmentFormName}") enriqueceu: ${enrichmentFields.join(", ")}.`);
    }
    // atualizar lia_attendances.piperun_id = vendaDeal.id
    return json({ flow_type: "preserve_vendas", piperun_id: String(vendaDeal.id), created_new: false });
  }

  // 3b. Outros funis abertos → fechar todos como Perdido (espelha SDR-CAPTAÇÃO)
  for (const deal of otherOpenDeals) {
    await piperunPut(PIPERUN_API_KEY, `deals/${deal.id}`, {
      status: 2,
      lost_reason: "reativacao_redelivery_meta",
    });
    console.log(`[lia-assign] enrichment-route: deal ${deal.id} (pipeline ${deal.pipeline_id}) fechado como Perdido`);
  }

  // 3c. Fresh Round Robin (NUNCA herda owner anterior)
  const newOwner = await pickRandomActiveVendedor(supabase);
  const newDealId = await createNewDeal(
    PIPERUN_API_KEY, personId, companyId, lead,
    PIPELINES.VENDAS, STAGES_VENDAS.SEM_CONTATO,
    newOwner.piperun_owner_id, customFields, leadEmail, supabase, []
  );

  if (newDealId) {
    await addDealNote(PIPERUN_API_KEY, Number(newDealId),
      `📩 [Dra. L.I.A.] Deal aberto a partir de re-entrega Meta (form "${enrichmentFormName}").\n` +
      `Deals anteriores fechados como Perdido (reativação): ${otherOpenDeals.length}.\n` +
      `Campos enriquecidos: ${enrichmentFields.join(", ")}.`);

    // atualizar lia_attendances: piperun_id, proprietario_lead_crm, owner_team_member_id
    await supabase.from("lia_attendances").update({
      piperun_id: newDealId,
      proprietario_lead_crm: newOwner.nome_completo,
      // ...
    }).eq("id", lead.id);
  }

  return json({
    flow_type: "new_deal_after_loss",
    piperun_id: newDealId,
    created_new: true,
    closed_deals: otherOpenDeals.map(d => ({ id: d.id, pipeline_id: d.pipeline_id })),
    new_owner: newOwner.nome_completo,
  });
}
```

**Skip explícito** dentro do branch: `cognitive-lead-analysis`, `buildSellerNotification`, `sendCampaignViaSellFlux`, WhatsApp summary, `createPerson`, `updatePersonFields`, `findOrCreateCompany`. Re-entrega não deve spammar vendedor — só renovar funil.

## Respeitando políticas existentes

| Política | Como respeitamos |
|---|---|
| **Commercial Intent Guard** | Só invoca se `source==meta_lead_ads && formName`; nunca cria Person |
| **Person Origin Frozen** | Não toca em `origin_id` (não chama `updatePersonFields` no modo restrito) |
| **GOLDEN RULE** | VENDAS aberto preserva owner intacto |
| **Blocked Seller** | Reusa fallback Patricia → Distribuidor |
| **Won deals NEVER TOUCH** | Filtro só pega `status === 0` |
| **Cognitive Lock TTL** | Não dispara análise → lock não tocado |
| **Sanitizer / PostgREST Embed** | Updates passam pelo sanitizer existente |
| **Histórico de deals** | Closes como Perdido (não delete) → contagem e `piperun_deals_history` preservados |

## Validação pós-deploy

**Caso Itamar (`b60f2c18`)** — `piperun_id=19241281`:

| Estado do deal 19241281 | Resultado esperado |
|---|---|
| Aberto em VENDAS | `flow_type=preserve_vendas`, nota curta no deal, custom fields atualizados |
| Aberto em ESTAGNADOS | Fecha 19241281 como Perdido, cria novo em VENDAS com Round Robin, `flow_type=new_deal_after_loss` |
| Perdido/Ganho | Cria novo em VENDAS sem fechar nada, `flow_type=new_deal_after_loss` (com `closed_deals=[]`) |

**SQL 7d:**
```sql
SELECT details->'deal_route_result'->>'flow_type' AS flow,
       count(*),
       sum(jsonb_array_length(coalesce(details->'deal_route_result'->'closed_deals','[]'::jsonb))) AS total_closed
FROM system_health_logs
WHERE error_type='meta_form_history_dedupe'
  AND created_at > now() - interval '7 days'
GROUP BY 1;
```

**Sanity:** `total_deals_all` do lead deve subir em 1 quando `flow_type=new_deal_after_loss` — confirma histórico preservado.

## Memória a atualizar (build mode)

Nova entrada: `mem://architecture/dedupe-redelivery-deal-route` — descrevendo régua aplicada após enrichment incremental.

## Fora de escopo

- Reabrir deals Ganho.
- Reativar via `moveDealToVendas` (régua é "fecha + cria novo", não move).
- WhatsApp/Sellflux/cognitive na re-entrega.
- Backfill retroativo.
- Mudar a janela 12h de dedupe.
