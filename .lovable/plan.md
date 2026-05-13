## Problema

Leads vindos do formulário de orçamento da Loja Integrada chegam ao PipeRun com:
- **Formulário (Origem):** `produto_sob_consulta`
- **Campanha:** `# - Formulário exocad I.A.` (herdada/ruído)
- **Produto de interesse:** vazio ou inferido genérico

Usuário quer:
- **Formulário (Origem PipeRun):** `# - Orçamento e-commerce`
- **Campanha:** `# - Orgânico e-commerce`
- **Produto de interesse:** o produto exato que o lead selecionou na Loja Integrada (vem em `produto_nome` / `produto_sku` / `page_title` no payload do front-end, hoje retido apenas em `raw_payload`).

## Causa

`smart-ops-ingest-lead` (linhas 220-340):
1. Recebe `form_name="produto_sob_consulta"` cru do front-end e propaga para `lia-assign.resolveOriginId()` que cria a Origin no PipeRun com esse nome.
2. `origem_campanha` é null para o ecom, então cai em fallback antigo do Person (Meta exocad).
3. `produto_nome`/`produto_sku`/`produto_id` estão em `META_KEYS` (linhas 329-333), então **só vão para `raw_payload`** — `produto_interesse` permanece null e o Deal é criado sem item identificado.

## Correção (1 arquivo)

`supabase/functions/smart-ops-ingest-lead/index.ts` — adicionar normalização logo após `formName` ser computado, **antes** do bloco `incomingData` (~linha 222):

```ts
// ── Loja Integrada: normalizar formulário de orçamento ──
const ECOM_QUOTE_LABEL    = "# - Orçamento e-commerce";
const ECOM_QUOTE_CAMPAIGN = "# - Orgânico e-commerce";
const isEcomQuote =
  source === "loja_integrada" &&
  (formName === "produto_sob_consulta" || formName === ECOM_QUOTE_LABEL);

if (isEcomQuote) {
  formName = ECOM_QUOTE_LABEL;
  payload.form_name       = ECOM_QUOTE_LABEL;
  payload.origem_campanha = ECOM_QUOTE_CAMPAIGN;
  payload.utm_campaign    = ECOM_QUOTE_CAMPAIGN;

  // Produto selecionado pelo lead na loja → produto_interesse
  const ecomProduct =
    (payload.produto_nome as string | null) ||
    (payload.produto_sku  as string | null) ||
    (payload.page_title   as string | null) ||
    null;
  if (ecomProduct) {
    produtoInteresse = ecomProduct;             // sobrescreve inferência genérica
    payload.produto_interesse = ecomProduct;
  }
}
```

E ajustar `force_new_deal` (linha ~623) para reconhecer o novo label além do legado:

```ts
force_new_deal:
  payload.force_new_deal === true ||
  (source === "loja_integrada" && (
    formName === ECOM_QUOTE_LABEL ||
    formName === "produto_sob_consulta"
  )),
```

> `produto_nome`, `produto_sku`, `produto_id` continuam em `META_KEYS` (preservados em `raw_payload` para auditoria) — não viram colunas inferidas.

## Efeito esperado

Próximo lead da Loja Integrada (ex.: thiago.nct@gmail.com com `produto_nome="exocad ChairsideCAD"`):
- `lia_attendances.form_name = "# - Orçamento e-commerce"`
- `lia_attendances.origem_campanha = "# - Orgânico e-commerce"`
- `lia_attendances.produto_interesse = "exocad ChairsideCAD"` (nome cru do produto da loja)
- PipeRun Deal Origin = `# - Orçamento e-commerce`
- Campanha (custom field/nota) = `# - Orgânico e-commerce`
- Timeline `form_submission` mostra `Formulário: # - Orçamento e-commerce`
- `force_new_deal=true` continua (cada orçamento = nova oportunidade)

## O que NÃO muda

- Golden Rule, DEDUPE/FUNIL Guard, Commercial Intent Guard, Person Origin Frozen — intactos.
- `produto_interesse_auto` (inferência por keyword) — continua disponível como fallback histórico.
- Outros formulários Loja Integrada (se houver) — não afetados.
- Leads históricos com Origin `produto_sob_consulta` no PipeRun — não retroativos (apenas novos ingests).

## Validação pós-deploy

1. Reenviar payload do Thiago via `smart-ops-ingest-lead` com `produto_nome` real.
2. Logs `[lia-assign] Origin found/created: "# - Orçamento e-commerce" → <id>`.
3. SQL:
   ```sql
   SELECT form_name, origem_campanha, utm_campaign, produto_interesse, raw_payload->>'produto_nome'
   FROM lia_attendances WHERE email='thiago.nct@gmail.com';
   ```
4. PipeRun: novo Deal com Origin `# - Orçamento e-commerce`, campanha `# - Orgânico e-commerce` e produto correto.
5. Atualizar `mem://integration/piperun-deal-metadata-rules`: "Loja Integrada quote form normalizado para `# - Orçamento e-commerce` / campanha `# - Orgânico e-commerce`; `produto_interesse` = `produto_nome` do payload da loja."
