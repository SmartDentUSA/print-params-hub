## Escopo

Alterar apenas o formulário (`PublicFormPage.tsx`), o builder (`SmartOpsFormBuilder.tsx`) e a função de métricas (`fn_form_metrics`). A landing page não será tocada.

## 1) Contraste da fonte dentro dos campos

Diagnóstico: quando o formulário usa fundo escuro (ex.: `bg_color=#1D1446`, `theme_mode=light`), o cálculo automático define `--form-body` como quase-branco. O `<Input>` do shadcn herda `color` desse `--form-body`, deixando o texto digitado invisível sobre o `bg-background` branco do input. A regra anterior `.public-form-page:not(.dark) input { color: #0F172A }` é sobrescrita em alguns navegadores por herança/especificidade.

Correção em `src/pages/PublicFormPage.tsx` (bloco `<style>`):
- Forçar cor legível **sempre** em `input, select, textarea` do formulário, **independente de `.dark`**, usando `!important` e cobrindo também o `PhoneInputWithDDI` (`.public-form-page .public-form-page input, .public-form-page select, .public-form-page textarea { color: #0F172A !important; caret-color: #0F172A !important; }`).
- Manter regra específica para `.public-form-page.dark input` com `color: #f5f5f5 !important` (usada apenas quando `theme_mode=dark` — a landing page não é afetada).
- Manter placeholders com `#64748B` / `rgba(255,255,255,.6)` conforme o modo.

Nenhuma alteração em variáveis globais, tokens de tema, ou na landing page.

## 2) Novo modo de exibição: "Primeiras 3 perguntas"

Objetivo: exibir apenas as 3 primeiras perguntas visíveis; ao clicar em Enviar, salvar o lead com esses 3 campos e (opcionalmente) continuar. Comportamento pedido: "aparecer as primeiras 3 perguntas do formulário".

Alterações:
- **DB (migration)**: nenhum schema novo. A coluna `smartops_forms.display_mode` (text) já existe — passará a aceitar o valor `"first_three"` (validação apenas no app).
- **`SmartOpsFormBuilder.tsx`**:
  - Ampliar tipo `metaDisplayMode` para `"list" | "step" | "first_three"`.
  - Adicionar `<SelectItem value="first_three">Somente as 3 primeiras perguntas</SelectItem>` no dropdown "Como as perguntas aparecem".
  - Manter salvamento existente (`display_mode: metaDisplayMode`).
- **`PublicFormPage.tsx`**:
  - Novo derivado `isFirstThreeMode = form?.display_mode === "first_three"`.
  - `visibleFields`: quando `isFirstThreeMode`, `renderableFields.slice(0, 3)`.
  - Validação só considera os campos visíveis (já é o caso do modo lista, mantido).
  - Botão de submit reutiliza o layout do modo lista (não há próximo passo).

## 3) Estatística "Ganhas" — contar qualquer venda pós-cadastro

Diagnóstico: `fn_form_metrics` conta como `deals_won` apenas negócios cujo `origem` no `piperun_deals_history` bate exatamente com `form_name`. Um lead que preencheu o formulário e depois comprou por outro canal (e-commerce, outro deal, Astron, upsell) não é contado.

Correção (migration em `fn_form_metrics`):
- Trocar o CTE `wins`: contar leads (`lia_attendances`) cujo `form_name = f.name`, não-mesclados, com criação dentro do período, e que possuam **qualquer** conversão/ganho após `la.created_at`:
  - Um `piperun_deals_history[*]` com `status ILIKE 'ganha'` e `created_at >= la.created_at - interval '1 day'` (independente da `origem`), **OU**
  - `la.total_deals_won > 0` combinado com `la.ltv_total > 0` (fallback quando o histórico ainda não replicou), **OU**
  - Pedido em `loja_integrada_orders` vinculado ao mesmo `email`/`telefone` do lead com `created_at >= la.created_at`.
- Manter filtros de canonical lead (`merged_into IS NULL`) e a exclusão de `source IN ('loja_integrada','astron_postback')` na contagem de leads (o formulário não gera esses sources).
- Sem mudanças em `visitors`, `unique_visitors`, `leads`, `daily_series`.
- Sem mudanças no frontend — os campos retornados são os mesmos.

Observação: a métrica passa a refletir a intenção "qualquer lead ganho oriundo deste formulário", incluindo e-commerce pós-cadastro.

## Fora do escopo

- Landing page (`SmartOpsFormLandingPage*`), tema global, tokens do design system.
- Ajuste no link do WhatsApp (já confirmado como link válido — sem mudança de código nesta iteração).
- Não altero `success_redirect_url` nem outros formulários.

## Validação

1. Abrir `https://parametros.smartdent.com.br/f/exocad_dentalcad_rms` e digitar em cada campo — texto legível.
2. No builder, editar formulário → alterar "Como as perguntas aparecem" → **Somente as 3 primeiras perguntas** → salvar → recarregar public form → apenas 3 primeiros campos aparecem, submit funciona.
3. Rodar `SELECT * FROM fn_form_metrics(30) WHERE form_id = '<exocad>'` e conferir `deals_won` > 0 se houver leads deste formulário com compras posteriores.
