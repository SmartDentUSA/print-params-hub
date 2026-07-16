## Objetivo
Destravar a reativação Estagnados→Vendas para leads que chegam via webhook do Meta Lead Ads, passando `new_conversion_confirmed` e `conversion_key` pela cadeia `meta-lead-webhook → ingest-lead → lia-assign`, satisfazendo a Golden Rule sem alterar sua lógica.

## Mudanças

### 1. `supabase/functions/smart-ops-meta-lead-webhook/index.ts`
No objeto `normalizedPayload` (montado antes da chamada a `smart-ops-ingest-lead`), adicionar duas propriedades:

```ts
new_conversion_confirmed: true,
conversion_key: `meta_leadgen:${leadgenId}`,
```

Cada `leadgen_id` do Meta é único e prova conversão nova legítima. Nenhuma outra alteração no arquivo.

### 2. `supabase/functions/smart-ops-ingest-lead/index.ts`
No dispatch para `smart-ops-lia-assign`, repassar os dois campos **apenas se** vierem no payload (não inventar para outros callers):

```ts
const liaAssignPromise = dispatchAsync("smart-ops-lia-assign", {
  lead_id: leadId,
  source,
  trigger: "ingest-lead",
  ...(payload.new_conversion_confirmed === true && payload.conversion_key
    ? {
        new_conversion_confirmed: true,
        conversion_key: String(payload.conversion_key),
      }
    : {}),
});
```

Não tocar em `mergeSmartLead`, `validateLeadIdentity`, nem no bloco de `normalizeBrazilianPhone` / fix last11.

## Fora de escopo (não alterar)
- `smart-ops-lia-assign/index.ts` (já lê os dois campos corretamente)
- `golden-rule-guard.ts`
- Outros callers de `ingest-lead` (`meta-lead-ads-pull`, `smart-ops-meta-csv-backfill`, reprocessamentos manuais) — devem continuar sem passar `new_conversion_confirmed`.

## Validação pós-deploy
1. Build sem erro de sintaxe nos dois arquivos.
2. Lead de teste (email novo, deal aberto apenas em pipeline 72938 Estagnados) via `smart-ops-meta-lead-webhook`.
3. `system_health_logs`: resultado deixa de ser `existing_lead_no_new_conversion_cdp_only` e passa a registrar `reactivate_estagnado_new_deal` (ou equivalente).
4. PipeRun: deal antigo do Estagnados marcado como "Perdido — Novo interesse"; deal novo criado no Funil de Vendas com vendedor ativo sorteado (round-robin).

## Memória a atualizar após execução
`mem/architecture/estagnados-redelivery-reactivation.md` — registrar que o gatilho `new_conversion_confirmed`/`conversion_key` agora flui do Meta webhook via ingest-lead, complementando os escape hatches já documentados nas rotas A e B de dedupe.
