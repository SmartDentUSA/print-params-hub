

# Fluxo Comercial com Botoes de Qualificacao: Scan | CAD | Print | Make + Workflow Completo

## O que muda

Quando o usuario seleciona o topico **comercial** ("Quero transformar minha vida profissional..."), em vez da IA fazer perguntas de qualificacao por texto, o chat exibe **botoes visuais** para o usuario escolher em qual parte do fluxo digital quer entrar:

```text
Linha 1:  [ Scan ]  [ CAD ]  [ Print ]  [ Make ]
Linha 2:  [      Workflow Completo       ]
```

Cada botao leva direto para os cards de produtos da categoria correspondente. O botao "Workflow Completo" inicia o fluxo guiado completo (Scanner -> Impressora -> Resinas -> Consultoria).

## Mapeamento dos botoes para categorias do banco

| Botao | Categoria no banco | O que mostra |
|-------|--------------------|--------------|
| Scan | SCANNERS 3D (8 produtos) | Cards de scanners |
| CAD | SOFTWARES (2 produtos) | Cards de softwares CAD |
| Print | IMPRESSAO 3D (6 produtos) | Cards de impressoras |
| Make | RESINAS 3D (28+ produtos) + POS-IMPRESSAO (8) + CARACTERIZACAO (27) | Cards de resinas, pos-impressao e caracterizacao (agrupados por subcategoria) |
| Workflow Completo | Todas as categorias acima, em sequencia guiada | Scan -> CAD -> Print -> Make, passo a passo |

## Mudancas tecnicas

### 1. Novo componente: `src/components/CommercialFlow.tsx`

Componente que gerencia a qualificacao visual e o fluxo guiado comercial:

- **Props**: `step`, `onStepChange`, `onProductSelect`, `onMultiSelect`
- **Steps**: `qualify` (botoes iniciais) | `scan` | `cad` | `print` | `make` | `summary`
- **Qualify step**: Renderiza os 5 botoes (Scan, CAD, Print, Make + Workflow Completo) com icones/emojis
- **Category steps**: Busca produtos do Supabase por `product_category`, exibe cards clicaveis (reutiliza o estilo visual do `ProductsFlow` existente)
- **Make step**: Especial - mostra resinas com multi-selecao (checkboxes visuais + botao "Confirmar selecao")
- **Workflow mode**: Flag interna `isFullWorkflow` que, apos cada selecao, avanca automaticamente para a proxima etapa (scan -> cad -> print -> make -> summary)
- **Selecao unica** (Scan, CAD, Print): click no card envia o produto escolhido para a LIA explicar e avancar
- **Selecao multipla** (Make/Resinas): usuario seleciona varios, confirma, e a LIA recebe a lista completa

Layout do step `qualify`:

```text
+-------------------------------+
| Em qual etapa do fluxo voce   |
| quer comecar?                 |
+-------------------------------+

  [Scan]   [CAD]   [Print]  [Make]
  [        Workflow Completo       ]
```

### 2. Modificar `src/components/DraLIA.tsx`

- Adicionar estado `commercialFlowStep`: `'qualify' | 'scan' | 'cad' | 'print' | 'make' | 'summary' | null`
- Adicionar estado `commercialSelections`: objeto acumulando as escolhas do usuario
- Quando `topicContext === 'commercial'`:
  - Apos a IA responder a saudacao inicial, mostrar `CommercialFlow` com `step='qualify'`
  - Quando usuario clica em um botao de categoria (ex: Scan), avancar para `step='scan'` que mostra os cards
  - Quando usuario clica em um card, enviar para a IA: "Escolhi o [nome]. Me conte sobre ele comparado as outras opcoes." e avancar para proxima etapa se estiver em Workflow Completo
  - No modo Workflow Completo, apos cada resposta da IA, mostrar cards da proxima etapa automaticamente
  - No step `make` (resinas), permitir multi-selecao e enviar lista completa para a IA
  - No step `summary`, enviar todas as selecoes para a IA montar consultoria final (ROI, treinamentos, combo)

- Logica de integracao no handleTopicSelect:

```text
if (opt.id === 'commercial') {
  -> envia mensagem para IA (saudacao)
  -> apos resposta, ativa commercialFlowStep = 'qualify'
  -> botoes aparecem abaixo da mensagem da IA
}
```

### 3. Nenhuma mudanca no backend nesta fase

O backend (dra-lia) ja tem o prompt modular (`buildCommercialInstruction`) e o contexto estruturado (`buildStructuredContext`). O frontend controla o fluxo visual e envia as selecoes como mensagens normais. O backend recebe "Escolhi o Medit i700" e responde com dados do RAG normalmente.

Numa fase futura, o backend pode enviar `commercial_step_hint` no SSE para controlar os cards, mas nesta implementacao o frontend gerencia tudo localmente.

## Fluxo do usuario (exemplo: Workflow Completo)

```text
1. Usuario clica "Quero transformar minha vida profissional"
2. IA: "Oi! Em qual parte do fluxo digital voce quer comecar?"
3. [Scan] [CAD] [Print] [Make] / [Workflow Completo]
4. Usuario clica "Workflow Completo"
5. Cards de SCANNERS aparecem
6. Usuario clica "Medit i700"
7. IA: "Otima escolha! O i700 se destaca por..."
8. Cards de SOFTWARES (CAD) aparecem
9. Usuario clica "exocad"
10. IA: "O exocad e o padrao ouro para..."
11. Cards de IMPRESSORAS aparecem
12. Usuario clica "Asiga MAX UV"
13. IA: "A Asiga MAX UV combina perfeitamente com..."
14. Cards de RESINAS aparecem (multi-selecao)
15. Usuario seleciona 3 resinas -> Confirmar
16. IA monta consultoria final: resumo do combo, ROI, treinamentos
```

## Fluxo do usuario (exemplo: entrada direta)

```text
1. Usuario clica "Quero transformar minha vida profissional"
2. IA: saudacao
3. [Scan] [CAD] [Print] [Make] / [Workflow Completo]
4. Usuario clica "Print"
5. Cards de IMPRESSORAS aparecem
6. Usuario clica "Asiga PRO 4K"
7. IA: "A PRO 4K e ideal para... Ja pensou em quais resinas usar?"
8. (opcional) Cards de resinas aparecem como sugestao
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/CommercialFlow.tsx` | NOVO - Componente com botoes de qualificacao + cards por categoria |
| `src/components/DraLIA.tsx` | MODIFICAR - Adicionar estados e integracao do CommercialFlow |

## Ordem de implementacao

1. Criar `CommercialFlow.tsx` com step `qualify` (botoes) e steps de categoria (cards)
2. Integrar no `DraLIA.tsx` com estados e transicoes
3. Testar fluxo completo e entradas parciais

