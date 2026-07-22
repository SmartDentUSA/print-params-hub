# Plano: Reprocessar 2 leads + Corrigir origem/produto no Funil de Vendas para e-commerce

## Parte 1 — Reprocessar Reginaldo e Gustavo

Estado atual no CDP:
- **Reginaldo** (`reginaldosouzacp@gmail.com`) — piperun_id `60167444` em **Funil Estagnados**. Form: `# - PósCura- Smart Dent`, produto: `UV ShapeCure D`.
- **Gustavo** (`gustavogbarcelos92@gmail.com`) — piperun_id `60247571` em **CS Onboarding**. Form: `# - GlazeON- Smart Dent`, produto: `GlazeON Splint`.

Ação (invocar `smart-ops-lia-assign` uma vez para cada, com `force_new_deal: true`):
- **Reginaldo**: nova regra fecha o Estagnados como "Perdido — Solicitou novo contato através de formulários" **depois** que o novo deal em Vendas for criado. Golden Rule Primary já preserva o pipeline VENDAS.
- **Gustavo**: nova regra ignora o deal CS (mantém intocado) e abre um deal novo em Vendas. O `piperun_id` cacheado (CS) será zerado no branch CS para não confundir o dedupe, e o novo `piperun_id` (Vendas) será persistido em `deals[]`.

Sem edição de código nesta parte — só execução via `supabase--curl_edge_functions`.

## Parte 2 — E-commerce: produto de interesse não chega ao PipeRun

Diagnóstico dos últimos leads `source=loja_integrada`:
- `produto_interesse` **está gravado** no `lia_attendances` (ex.: `Scanner Intraoral MEDIT i900`, `DentalCAD - Software CAD da exocad`).
- Todos com `form_name` preenchido têm `piperun_id` — ou seja, **entram** no PipeRun.
- Mas em `lia_attendances.form_name` fica `produto_sob_consulta` cru — a normalização feita em `smart-ops-ingest-lead` (`ECOM_QUOTE_LABEL = "# - Orçamento e-commerce"`) só reescreve `payload.form_name` local, e depois o UPDATE em `lia_attendances` grava `formName` (variável local, já renomeada) mas em existingLead path atualiza — precisa verificar. O impacto: o `resolveOriginId(form_name)` do lia-assign recebe `produto_sob_consulta`, que provavelmente cai em origem genérica no PipeRun, e o custom field "Produto de interesse" pode não estar sendo mapeado pra esse `form_name` desconhecido.

Investigação a completar (antes de qualquer fix — não vou assumir o culpado):
1. Ler `smart-ops-lia-assign/index.ts` na parte que monta `custom_fields` de Deal e checar se `produto_interesse` da tabela é sempre enviado para o campo PipeRun "Produto de interesse", independente de `form_name`.
2. Checar diretamente no PipeRun (via `piperun-get-deal` ou consulta ao mirror) um dos deals recentes (ex.: `62103010` Laiz) e ver se o campo "Produto de interesse" está preenchido.
3. Confirmar se `form_name` gravado em `lia_attendances` está sendo `produto_sob_consulta` ou `# - Orçamento e-commerce` — a query mostrou os dois formatos coexistindo, o que sugere que a normalização vazou em algum caminho.

Só depois desse diagnóstico definir o fix (candidatos, sem me comprometer):
- Garantir que ingest sempre persista `form_name = "# - Orçamento e-commerce"` no CDP (não só no payload local).
- Garantir que lia-assign envie o custom field "Produto de interesse" a partir de `lia_attendances.produto_interesse` para toda Deal, não só para forms conhecidos.
- Cadastrar/mapear a origem `# - Orçamento e-commerce` no `resolveOriginId` (via `piperun_origins_cache`).

## Detalhes técnicos

- Endpoint: `POST /functions/v1/smart-ops-lia-assign` com body `{ lead_id, force_new_deal: true, commercial_override: true }`.
- Guarda comercial: form_name já satisfaz `evaluateCommercialIntent` (não precisa override, mas mantemos para simetria).
- Para inspecionar o deal no PipeRun: `supabase--curl_edge_functions` em `piperun-get-deal?dealId=62103010` (ou usar o `piperun_deals_mirror` se existir).

## Ordem de execução (build mode)

1. Reprocessar Reginaldo (invocação única).
2. Reprocessar Gustavo (invocação única).
3. Auditar deal `62103010` (Laiz, e-commerce) no PipeRun — custom fields.
4. Ler trecho de `smart-ops-lia-assign` que monta custom fields.
5. Reportar diagnóstico e propor patch pontual (form_name persistente + origin cadastrada + custom field garantido).
