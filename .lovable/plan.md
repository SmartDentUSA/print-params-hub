
# Garantir captura universal de re-entregas Meta (sem perder dados)

## Problema

`fvteche@yahoo.com.br` (e classe inteira de re-entregas Meta antigas): lead criado em Fev/26 sem telefone. Meta reentregou hoje com telefone `+5531993252575` e form `# - Impresoras - Smart Dent`. **Resultado atual: telefone descartado, nenhum deal aberto.**

**Causa raiz:** a régua "preserva deal em VENDAS ou abre fresh deal em VENDAS" (`executarEnrichmentDealRoute` em `smart-ops-lia-assign`) só é chamada quando a dedupe cai no caminho `meta_form_history_12h` (re-entrega < 12h). Os caminhos `HARD_DEDUPE` e `FAMILY_DEDUPE_LIFETIME` em `smart-ops-ingest-lead` retornam `duplicate_skipped` imediatamente, **sem enriquecer e sem rotear deal**. Resultado: cada re-entrega Meta > 12h perde silenciosamente o payload novo.

A régua de deal que o usuário quer **já existe e está correta** — o fix é apenas fazê-la rodar em TODA re-entrega Meta com `form_name`, mais proteger os funis CS.

Nenhuma UI nova. Apenas backend.

---

## Mudança 1 — Proteger funil CS no roteador de deal

Arquivo: `supabase/functions/smart-ops-lia-assign/index.ts`, função `executarEnrichmentDealRoute` (~linha 1899-2070), CASE B (~linha 1983-1998).

Hoje o loop fecha como Perdido todos os deals abertos em pipelines ≠ VENDAS. Adicionar lista de pipelines protegidos:

```ts
const PROTECTED_PIPELINES = new Set<number>([
  PIPELINES.CS_ONBOARDING,        // 83896
  PIPELINES.GANHOS_ALEATORIOS_CS, // 102893
]);
const otherOpenDeals = openDeals.filter(
  (d) => Number(d.pipeline_id) !== PIPELINES.VENDAS
      && !PROTECTED_PIPELINES.has(Number(d.pipeline_id)),
);
```

Deals em CS Onboarding e Ganhos Aleatórios (CS) ficam intocados. Mesmo havendo CS aberto, ainda abrimos novo deal em VENDAS (CASE C) — re-entrega Meta é intenção comercial. Nota anexa ao novo deal lista os ids CS preservados.

---

## Mudança 2 — Estender enrichment+deal-route para TODA re-entrega Meta

Arquivo: `supabase/functions/smart-ops-ingest-lead/index.ts`.

Antes dos `return` early-exit em:
- `HARD_DEDUPE_SKIPPED` (~linha 108-122)
- `FAMILY_DEDUPE_LIFETIME_SKIPPED` (~linha 184-197)

Adicionar bloco condicional `if (source === 'meta_lead_ads' && formName && priorLead?.id)`:

1. **Backfill incremental** dos campos do payload no lead canônico, usando a MESMA lógica já presente no bloco `meta_form_history_12h` (linhas 540-575): `coalesce` em `telefone_normalized`, `email`, `area_atuacao`, `especialidade`, etc; `alwaysUpdateEquip` para `tem_impressora`/`tem_scanner`/`impressora_modelo`; append em `form_data.enrichment_history` com `via: "hard_dedupe_universal"` ou `"family_dedupe_universal"` e snapshot do payload.

2. **Invocar `smart-ops-lia-assign` em `enrichment_only_route_deal`** (mesma chamada da linha 628-639):
   ```ts
   await supabase.functions.invoke("smart-ops-lia-assign", {
     body: {
       lead_id: priorLead.id,
       enrichment_only_route_deal: true,
       enrichment_form_name: formName,
       enriched_fields: enrichedFields,
       trigger: "hard_dedupe_universal", // ou family_dedupe_universal
     },
   });
   ```

3. Devolver `deal_route_result` e `incremental_enrichment` na resposta JSON.

Resultado: re-entrega Meta de qualquer idade aplica a régua VENDAS automaticamente — preserva owner se já houver deal em VENDAS, ou fecha funis não-CS + Fresh RR + novo deal em VENDAS. Telefone e demais campos do form sempre gravados.

---

## Mudança 3 — Backfill manual de `fvteche@yahoo.com.br`

Como dados do trigger atual já foram descartados, fazer backfill one-shot:
- Atualizar `lia_attendances`: `telefone_normalized = '5531993252575'`, `telefone_raw = '+5531993252575'`, `whatsapp_number = '+5531993252575'`.
- Invocar `smart-ops-lia-assign` com `enrichment_only_route_deal=true` para esse lead → régua nova abre deal em VENDAS (lead não tem deal em VENDAS hoje).

Feito via SQL migration + uma chamada curl ao edge function após deploy.

---

## Mudança 4 — Memória

Atualizar `mem://architecture/dedupe-redelivery-deal-route`: substituir "Re-entrega Meta <12h" por "Toda re-entrega Meta com `form_name` aplica enrichment + régua de deal universal (preserva VENDAS ou abre novo). CS Onboarding e Ganhos Aleatórios (CS) são pipelines protegidos — nunca fechados."

---

## Arquivos editados

- `supabase/functions/smart-ops-lia-assign/index.ts` — `PROTECTED_PIPELINES` no filtro de `otherOpenDeals`.
- `supabase/functions/smart-ops-ingest-lead/index.ts` — bloco enrichment+invoke antes dos dois early-returns.
- `mem://architecture/dedupe-redelivery-deal-route` — atualizar regra.
- Migration SQL — backfill do `fvteche`.

**Não-objetivos (explícito do usuário):**
- Nenhuma nova tela, página, rota, componente UI.
- Nenhuma edge function nova.
- Sem auditoria interativa.

**Garantias:**
- CS Onboarding nunca é fechado.
- Deals Ganhos (`status=1`) nunca tocados (já protegido).
- Pessoa nunca recriada (apenas enriquecida).
- Sem retroagir leads antigos automaticamente (só `fvteche` por backfill manual nesta entrega).

**Risco/efeito esperado:** próximas horas devem ver pico de deals novos em VENDAS conforme o cron Meta reentregar leads antigos sem deal aberto em VENDAS. Esperado e desejado.
