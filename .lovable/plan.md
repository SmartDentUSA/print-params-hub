## Layout híbrido + rotulagem por resposta

### Estrutura visual

- **Perguntas principais** (sem `show_if`) ficam no **trilho horizontal** (esquerda → direita), na ordem do `order_index`.
- **Condicionais** (com `show_if`) descem **verticalmente** abaixo da principal que as dispara, formando uma coluna por principal.
- Cadeias de condicionais (condicional que depende de outra condicional) continuam empilhando para baixo na mesma coluna.

```text
[Q1: Tem impressora?] ──Sim──→ [Q3: Tem scanner?] ──→ [Q5] ──→ [Fim]
   │                              │
   │ Não                          │ Não
   ▼                              ▼
[Q2a: Quer comprar?]           [Q4a: Quer comprar?]
   │
   ▼
[Q2b: Qual marca?]
```

### Regra-chave: rótulo da seta = resposta que ativa

Toda aresta que entra em uma condicional deve mostrar **qual resposta da pergunta anterior** ativa esse caminho. A lógica já existe parcialmente no `buildGraph` atual (variável `branch.label`), mas vai ser reforçada:

1. Para cada **principal P** com opções (Sim/Não, marcas, etc.):
   - Para cada opção `o`:
     - Se existe condicional `C` filha de P cuja `show_if` é satisfeita por `o` → desenhar seta **vertical** de P↓C com label = `o.label` (ex.: "Não").
     - Senão (resposta pula condicionais) → desenhar seta **horizontal** de P→próxima principal com label = `o.label` (ex.: "Sim → continua").
2. Para condicional C → próxima principal: seta **horizontal** saindo da direita da última condicional da coluna até a próxima principal, com label da resposta de C que leva ao trilho (se C tiver opções).
3. Setas entre principais consecutivas sem ramificação ficam **sem label** (fluxo natural).

### Cor/estilo das arestas (mantém atual)

- Verde sólido = caminho ativo identificado por resposta.
- Cinza tracejada = "pula condicional" (mantém comportamento atual).
- Label sempre visível com fundo branco para legibilidade.

### Implementação em `src/components/SmartOpsFormFlowPreview.tsx`

1. **Substituir `layout()`** (que usa dagre) por posicionamento manual em grid:
   - `mains = fields.filter(f => !getShowIf(f))` ordenados por `order_index`.
   - Cada principal recebe `x = X0 + i*COL_W`, `y = Y0`.
   - Para cada principal, BFS pelos descendentes condicionais (`childrenOf(parentId)`), empilhando em `y += ROW_H` na mesma coluna.
   - `EndNode` à direita do último principal.

2. **Adicionar handles Top/Bottom** em `FieldNode` (já tem Left/Right). Em `EndNode` basta Left.

3. **Reescrever a seleção de handle por aresta** dentro do `buildGraph`:
   - Se `target` está na **mesma coluna** que `source` (filho condicional) → `sourceHandle="b"`, `targetHandle="t"` (vertical).
   - Se `target` está em **coluna à direita** (próxima principal ou End) → `sourceHandle="r"`, `targetHandle="l"` (horizontal).
   - Resolver coluna do target a partir do mapa `pos` calculado no layout (precisa rodar layout antes de finalizar handles, ou indexar por `mainColumnOf(fieldId)`).

4. **Garantir labels**: `branch.label` já existe — só reforçar que arestas verticais (P→condicional) sempre carreguem o label da resposta que ativa, e arestas horizontais que representam "pula" carreguem label da resposta + " → segue".

### Arquivo a alterar

- `src/components/SmartOpsFormFlowPreview.tsx` — função `layout`, componente `FieldNode` (handles), e a parte de criação de edges em `buildGraph` (sourceHandle/targetHandle + reforço de labels).

Nenhum outro arquivo precisa mudar.
