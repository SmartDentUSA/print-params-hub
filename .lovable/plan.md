## Objetivo

Qualquer submissão de um formulário público ativo (`smartops_forms.active=true`) deve **sempre abrir um Deal NOVO no Funil de Vendas do PipeRun**, mesmo que o lead já tenha Deal aberto em Vendas ou Estagnado. Mesmo comportamento que hoje só existe para Loja Integrada "Sob Consulta".

## Mudança única (cirúrgica)

**Arquivo:** `supabase/functions/smart-ops-ingest-lead/index.ts` (linhas 745–762)

O dispatch para `smart-ops-lia-assign` já aceita `force_new_deal`. Hoje ele só é `true` para Loja Integrada. Vamos expandir para **toda submissão de formulário** (ou seja, sempre que o ingest está sendo disparado pelo `PublicFormPage` / formulário ativo — caracterizado pela presença de `form_name` no payload).

```ts
force_new_deal:
  payload.force_new_deal === true ||
  // NOVO — toda submissão de formulário ativo abre Deal novo em Vendas
  (typeof formName === "string" && formName.trim().length > 0) ||
  (source === "loja_integrada" && (
    formName === ECOM_QUOTE_LABEL ||
    formName === "produto_sob_consulta"
  )),
```

Resultado:

- `smart-ops-lia-assign` (linha 2106) já trata `force_new_deal === true`:
  - Ignora preserve do Deal aberto em Vendas (Golden Rule é bypassada)
  - Ignora reativação de Estagnado
  - Zera `piperunId` cacheado pra não cair no dedupe-guard
  - Cai em `createNewDeal(...)` direto no `PIPELINES.VENDAS`
- Deal antigo permanece intocado (won/aberto/estagnado) — apenas se soma um novo na esteira de Vendas.

## O que NÃO muda

- Person/Company continuam reutilizando o mesmo `pessoa_piperun_id` / `empresa_piperun_id` (não duplica pessoa).
- Origem Person continua congelada no primeiro contato (Person Origin Frozen).
- `origin_name` do Deal continua sendo o `form_name` exato (Piperun Deals Metadata).
- Round-robin de owner volta a operar normalmente (sem herdar owner do Deal antigo, pois agora estamos criando Deal novo).
- Webhooks Sellflux/cognitivo/Meta continuam idem.
- Loja Integrada "Sob Consulta" continua disparando `force_new_deal` (já coberto pela condição existente).
- Astron postback, e-commerce order sync, WA inbound puro etc. **não disparam** `force_new_deal` porque não têm `form_name` (continuam respeitando Commercial Intent Guard).

## Efeito colateral esperado

- Lead que preenche 3 formulários diferentes terá 3 Deals abertos em paralelo em Funil de Vendas.
- Cada Deal carrega `origin_name` = nome do formulário que o originou → SDR distingue qual campanha gerou cada oportunidade.
- Round-robin distribui cada Deal novo para um vendedor (potencialmente diferentes vendedores no mesmo lead — alinhado ao modelo "oportunidade por intenção").

## Memória a atualizar

- `mem://integration/piperun-deal-metadata-rules` → adicionar nota: "Toda submissão de formulário ativo cria Deal novo em Vendas (force_new_deal=true). Person é reutilizada."
- Atualizar `mem://index.md` no item Commercial Intent Guard pra refletir que `form_name` agora também implica `force_new_deal`.

## Validação pós-deploy

1. Submeter `# - Formulário Padrão` no email `danilohen@gmail.com` (já tem Estagnado aberto).
2. Conferir em `deals` que surge novo registro com `pipeline_name='Funil de vendas'` e `piperun_created_at` da submissão.
3. Conferir que o Deal Estagnado antigo (58968895) permanece intocado.
4. Submeter de novo o mesmo formulário → deve gerar **outro** Deal novo em Vendas (não atualizar o anterior).
5. Conferir nos logs do `smart-ops-lia-assign`: `force_new_deal=true → bypassing vendaDeal/estagnDeal preserve`.

## Fora de escopo

- Sem alteração de schema.
- Sem mudança no Commercial Intent Guard (que continua bloqueando astron/ecommerce sem form).
- Sem mudança em PublicFormPage, ingest payload normalization, Sellflux ou cognitive analysis.

Aprova?
