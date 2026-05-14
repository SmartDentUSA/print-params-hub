## Contexto

Boa notícia: o esquema já tem o que precisamos.
- `smartops_form_fields.conditions` (jsonb) — já existe, mas hoje **não é lido nem editado** em nenhum lugar.
- `smartops_form_fields.order_index` — define a ordem das perguntas, usada no modo step.
- `PublicFormPage.tsx` já tem o modo step funcionando (`display_mode='step'` + `currentStep`).

Sobre o "HTML não alterado": o embed dos formulários é um `<iframe src="/f/{slug}">`. O HTML do iframe é o `PublicFormPage`, que **lê `display_mode` do banco em tempo real**. Não há HTML estático para mudar — basta o usuário recarregar a página onde o iframe está hospedado para ver o modo step. Se ainda assim não aparecer, é cache do navegador ou o iframe está apontando para outro slug. Posso validar isso depois.

## O que vamos construir

Lógica de **perguntas condicionais** (branching) no editor + no runtime, usando o campo `conditions` que já existe no banco.

### 1. Modelo de dados (sem migration — só convenção JSON)

Cada campo passa a ter `conditions` no formato:

```json
{
  "show_if": {
    "logic": "AND",                // AND | OR
    "rules": [
      { "field_id": "<uuid do campo pai>", "op": "equals", "value": "Sim" },
      { "field_id": "<uuid>", "op": "in", "value": ["Anycubic","Phrozen"] }
    ]
  }
}
```

Operadores suportados na v1: `equals`, `not_equals`, `in`, `not_in`, `is_empty`, `is_not_empty`.

Quando `conditions` for `null` ou `{}`, o campo é sempre exibido (comportamento atual).

### 2. Editor (`SmartOpsFormBuilder.tsx`)

Em cada campo, adicionar um accordion **"Lógica condicional"** com:
- Toggle: "Exibir este campo apenas se…"
- Seletor de lógica AND/OR
- Lista de regras, cada uma com:
  - Dropdown de **campo pai** (apenas campos com `order_index` menor que o atual e do tipo `select`/`radio`/`checkbox`/`text`)
  - Dropdown de **operador**
  - Input de **valor** (vira dropdown multi quando o pai é select/radio — usa as `options` do pai)
- Botão "+ Adicionar regra" / remover regra

Salvar grava em `conditions.show_if`.

Visualmente marcar campos dependentes com um badge "Condicional" e indentação para deixar a hierarquia legível na lista.

### 3. Runtime (`PublicFormPage.tsx`)

Criar helper `isFieldVisible(field, answers, allFields)` que avalia `conditions.show_if`.

Aplicar em dois pontos:

**Modo padrão (lista):** filtrar `fields` antes do `.map` de render.

**Modo step:** o `currentStep` percorre apenas campos visíveis. Implementar via `visibleFields = fields.filter(isFieldVisible)` recalculado a cada mudança de resposta. Cuidado:
- Ao responder uma pergunta pai e mudar a visibilidade de filhos, o `currentStep` precisa ser remapeado pelo `id` do campo atual, não pelo índice (senão pula/repete pergunta).
- Limpar respostas de campos que ficaram invisíveis no submit (para não enviar dado órfão).
- Barra de progresso usa `visibleFields.length` em vez de `fields.length`.

### 4. Validação

- Backend: trigger leve em `smartops_form_field_responses` **não** muda — continua aceitando o que vier.
- Frontend: `required` só é exigido se `isFieldVisible === true`.

### 5. Exemplo do fluxo do usuário (caso citado)

```text
1. Tem scanner intraoral?           [Sim/Não]
2. Qual marca do scanner?           show_if: #1 == "Sim"
3. Tem impressora 3D?               [Sim/Não]
4. Qual marca da impressora?        show_if: #3 == "Sim"
5. Você imprime guias cirúrgicas?   show_if: #3 == "Sim"
6. Qual marca de resina utiliza?    show_if: #5 == "Sim"
```

No modo step, quem responder "Não" em #1 pula direto para #3; quem responder "Não" em #3 vai direto pro fim.

## Arquivos afetados

- `src/components/SmartOpsFormBuilder.tsx` — UI do editor de condições por campo.
- `src/pages/PublicFormPage.tsx` — helper `isFieldVisible` + filtro nas duas modalidades de render + ajuste do step navigator + validação de required.
- (Opcional) `src/lib/formConditions.ts` — extrair o avaliador para um util testável.

Sem migration, sem mudança de tipos do Supabase (a coluna já existe).

## Fora de escopo (v1)

- Saltos para etapa específica ("pula para pergunta X") — usaremos só visibilidade. O efeito de "pular" acontece naturalmente porque campos invisíveis somem do step navigator.
- Operadores numéricos (`>`, `<`) — adicionar em v2 se precisar.
- Condições aninhadas (grupo de regras dentro de regra) — v1 é uma lista plana com AND/OR único.

## Pergunta antes de implementar

A regra "pula para outra principal" do exemplo é exatamente o comportamento de **esconder dependentes** (que é o que esse plano faz), ou você precisa de **goto explícito** (ex.: "se Não → vá direto pra pergunta 5, ignorando 3 e 4")? Pelo seu exemplo parece ser o primeiro, mas confirmo antes de codar.
