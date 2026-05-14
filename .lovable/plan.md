## O que muda

Hoje o diagrama só desenha aresta quando existe regra `show_if`. O caminho "Não" some — fica parecendo que o fluxo termina ali. Vou desenhar **todas as ramificações possíveis** de cada pergunta, inclusive os caminhos onde a próxima pergunta é pulada.

## Regra de roteamento (para cada pergunta-pai com opções)

Para cada pergunta do tipo `select` / `radio` / `boolean` com `options` definidas, gerar uma aresta **por opção**:

1. **Tem filhos para essa resposta?** (ex.: alguma pergunta posterior tem `show_if` que casa com essa opção)
   - **Sim** → aresta da pergunta-pai → primeiro filho que casa, com label = valor da resposta (ex.: `"Sim"`).
2. **Não tem filhos para essa resposta?**
   - Aresta da pergunta-pai → **próxima pergunta no fluxo** (a próxima por `order_index` que seria visível com essa resposta), com label = valor da resposta + estilo tracejado cinza ("pula").
   - Se não houver próxima pergunta visível → aresta para um nó terminal `[ Fim do formulário ]`.

Para perguntas **sem options** (text/email/phone): uma única aresta "próxima" sólida → próxima pergunta visível, label vazio.

Para perguntas com regra **`is_not_empty` / `is_empty`**: tratar como branches `preenchido` / `vazio`.

## Visual

- **Aresta "ativa"** (resposta → filho condicional): linha **sólida verde**, label com a resposta.
- **Aresta "pula"** (resposta que não ativa filho, vai pra próxima): linha **tracejada cinza**, label `"Não" → pula` (ou só o valor).
- **Aresta "default"** (campo sem options): linha **sólida cinza**, sem label.
- **Nó terminal** `[ ✓ Fim do formulário ]`: estilo distinto (cinza, ícone check) — único, todas as pontas finais convergem nele.
- Layout dagre TB continua igual; setas entram pelo top, saem pelo bottom.

## Exemplo do que o usuário vai ver

```text
        ┌──────────────────────┐
        │ #1 Tem scanner?      │
        └───┬───────────────┬──┘
        Sim│           Não┊┊(pula)
            ▼               ▼
   ┌──────────────┐    ┌──────────────────────┐
   │ #2 Marca?    │    │ #3 Tem impressora 3D?│
   └──────┬───────┘    └───┬───────────────┬──┘
          │             Sim│           Não┊┊(pula)
          ▼                 ▼               ▼
   ┌──────────────────┐  ┌──────────┐  ┌──────────────┐
   │ #3 Tem impressora?│ │ #4 Marca?│  │ ✓ Fim do form│
   └─────────┘         │ └────┬─────┘  └──────────────┘
                       │      ▼
                       │  ┌──────────────────┐
                       │  │ #5 Imprime guias?│
                       │  └─...
```

Toda resposta possível tem seta. Nada some.

## Onde aplico

**Editado:** `src/components/SmartOpsFormFlowPreview.tsx`
- Nova função `buildRichEdges(fields)` que percorre cada pergunta e gera as arestas conforme as regras acima.
- Adiciona o nó terminal `__end__`.
- Adiciona estilos `solid-active` / `dashed-skip` / `solid-default`.
- Mantém custom node, dagre, controls, minimap.

**Sem mudança:** demais arquivos.

## Edge cases

- Pergunta cuja regra usa `in [Anycubic, Phrozen]`: gera 1 aresta sólida saindo de cada uma dessas opções do pai (label = a opção). Outras opções do pai → tracejada para próxima.
- Pergunta com opção que é parent de **vários** filhos: múltiplas arestas sólidas saindo da mesma opção (uma por filho). Funciona naturalmente no xyflow.
- Pergunta com regra `equals "X"` mas o pai não tem essa opção cadastrada: nó vermelho "rota inválida".

## Pergunta antes de implementar

Confirma a semântica:
- Por **"próxima pergunta"** quando o usuário escolhe a opção que pula um bloco, você quer dizer **a próxima por `order_index` que ainda seria visível com essa resposta** (ou seja, posso ter que pular várias perguntas em cadeia)? Ou apenas a próxima por `order_index` literal (sem reavaliar a visibilidade)?

Recomendo a primeira (próxima visível em cadeia) — reflete fielmente o que o usuário do formulário vai ver.
