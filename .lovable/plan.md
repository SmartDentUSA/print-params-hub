## Diagnóstico

Lead `danilohen@gmail.com` (id `366ea619`, Person `46927163`) reprocessado pelo `smart-ops-lia-assign` várias vezes hoje **sem criar novo Deal**. O `piperun_id` cached `59681674` aponta para um Deal que está:

- `pipeline_id = 18784` (Funil de Vendas) ✅
- `deleted = 0` (vivo) ✅
- **`status = 3`** (perdida/cancelada — NÃO é open)

## Causa raiz

No último patch, o **DEDUPE GUARD** (linhas 2138-2150 de `smart-ops-lia-assign/index.ts`) passou a preservar o deal quando `isAlive && isInVendas`, mas **removeu o check de `isOpen`**:

```ts
const isAlive = dealData && dealData.deleted !== 1 && dealData.deleted !== true;
const isInVendas = cachedPipelineId === PIPELINES.VENDAS;
if (isAlive && isInVendas) { /* preserve */ }
```

Resultado: deals **fechados (perdida/cancelada/won) em Vendas** continuam sendo "preservados" via `updateExistingDeal`, e nenhum Deal novo é criado quando o lead volta a converter.

Isso também explica por que o `produto_sob_consulta` do Danilo (que deveria gerar novo Deal) não cria nada: o filtro `openDeals` já exclui o Deal 59681674 (status=3), portanto `vendaDeal=undefined` e o fluxo cai no else `new_deal` — mas o DEDUPE GUARD reabsorve o cached e curto-circuita `createNewDeal`.

## Correção (1 arquivo)

`supabase/functions/smart-ops-lia-assign/index.ts` — bloco DEDUPE GUARD (~linha 2138):

```ts
const isAlive  = dealData && dealData.deleted !== 1 && dealData.deleted !== true;
const isOpen   = Number(dealData?.status) === 0;             // ← restaurar
const cachedPipelineId = Number(dealData?.pipeline_id);
const isInVendas = cachedPipelineId === PIPELINES.VENDAS;

if (isAlive && isOpen && isInVendas) {
  // preserva apenas Deal ABERTO no Funil de Vendas
  piperunId = cachedDealId;
  flowType = "preserve_cached_deal";
  await updateExistingDeal(...);
} else if (isAlive && isOpen && !isInVendas) {
  // aberto em CS / Suporte / Treinamento → criar NOVO em Vendas
  console.log(`[lia-assign] FUNIL GUARD: cached deal ${cachedDealId} aberto em pipeline ${cachedPipelineId} (não-Vendas) → criando NOVO Deal em Vendas`);
} else {
  // fechado (won/lost/cancel) ou deletado → criar NOVO
  console.warn(`[lia-assign] DEDUPE GUARD: cached deal ${cachedDealId} fechado (status=${dealData?.status}) ou morto, criando NOVO Deal`);
}
```

## O que NÃO muda

- **Golden Rule** (`vendaDeal` = open + Vendas + !freezed) — intacto, executa **antes** do DEDUPE GUARD.
- **Won deals** — continuam intocados via Golden Rule (`vendaDeal` os captura quando `status=1` for incluído? — não: Golden Rule só pega `status===0`). Won não passa pelo guard porque Golden Rule só lê openDeals; mas o cached pode ser Won → com a correção, Won (status=1) também cairá no "criar novo", o que é o desejado pelo usuário ("sempre criar novo lead que não esteja no funil de vendas [aberto]").
- Estagnados, Commercial Intent Guard, Person Creation Integrity, `force_new_deal`, custom fields — intactos.

## Validação pós-deploy

1. Reprocessar `lead_id=366ea619-33c3-4fb1-b6ac-cf7c733aaac7` com `force=true`. Esperado: novo Deal criado em Vendas (Deal 59681674 está perdido).
2. Conferir logs `[lia-assign] DEDUPE GUARD: cached deal ... fechado (status=3)`.
3. SQL: `SELECT piperun_id, status_oportunidade FROM lia_attendances WHERE id='366ea619-...'` — `piperun_id` deve mudar.
4. Atualizar `mem://architecture/commercial-intent-guard.md`: "DEDUPE preserva Deal só se aberto **e** em Vendas. Qualquer Deal fechado (won/lost/cancel) → cria novo."
