## Objetivo
Garantir que **todo lead com `piperun_id` apontando para um Deal fora do Funil de Vendas** receba **obrigatoriamente** um novo Deal no Funil de Vendas. Apenas Deals abertos no próprio Funil de Vendas continuam sendo preservados (dedupe).

## Arquivo único alterado
`supabase/functions/smart-ops-lia-assign/index.ts` — bloco **DEDUPE GUARD** (≈ linhas 2130–2150, logo antes de `createNewDeal`).

## Mudança lógica

Hoje:
```
if (isAlive && isOpen) → preserva cached deal (independente do funil)
```

Passa a ser:
```
const isInVendas = Number(dealData?.pipeline_id) === PIPELINES.VENDAS;

if (isAlive && isOpen && isInVendas) {
  // preserva cached deal — está aberto no Funil de Vendas
  piperunId = cachedDealId;
  flowType = "preserve_cached_deal";
  await updateExistingDeal(...);
} else if (isAlive && !isInVendas) {
  // cached deal vivo mas em CS / Suporte / Treinamento / Distribuidor
  // → OBRIGATÓRIO criar NOVO Deal no Funil de Vendas
  console.log(`[lia-assign] FUNIL GUARD: cached deal ${cachedDealId} em pipeline ${cachedPipelineId} (não-Vendas) → criando NOVO Deal em Vendas`);
  // segue fluxo normal de createNewDeal abaixo
} else {
  // closed/dead → cria novo (comportamento já existente)
}
```

## O que NÃO muda
- **Golden Rule** (`vendaDeal` preservado quando já há Deal Won) — intacta.
- **Estagnados** continuam sendo reativados via `moveDealToVendas` (não passa pelo guard).
- **Commercial Intent Guard**, **Person Creation Integrity**, **Person Origin Frozen** — intactos.
- `force_new_deal` (Loja Integrada Sob Consulta) — intacto.
- Custom fields PESSOA + DEAL (`fields:[{id,valor}]`) entregues no patch anterior — intactos.

## Validação pós-deploy
1. SQL: contar leads das últimas 24h cujo `piperun_pipeline_name != 'Funil de vendas'` e que receberam novo Deal em Vendas.
2. Reprocessar `lead_id=366ea619-33c3-4fb1-b6ac-cf7c733aaac7` (Danilo Henrique, `piperun_id=59681674`) com `force_new_deal=false`. Se o Deal cached estiver em CS/Treinamento, deve gerar novo Deal em Vendas; se já estiver em Vendas, preserva.
3. Verificar logs `[lia-assign] FUNIL GUARD:` no Edge Function logs.

## Memória a atualizar
`mem://architecture/commercial-intent-guard.md` — adicionar nota: "Dedupe de `piperun_id` só preserva Deal se estiver aberto **e no Funil de Vendas**. Deals em CS/Suporte/Treinamento forçam criação de novo Deal em Vendas."
