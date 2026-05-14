## Ideia

Adicionar, no final do `SmartOpsSdrCaptacaoEditor` (logo abaixo das Seções C + D), um painel **"Visualizar fluxo das perguntas"** que renderiza a árvore de dependências — mostrando visualmente quem depende de quem, e quais respostas levam a quais perguntas.

Isso valida o que você acabou de configurar **sem precisar abrir o `/f/{slug}` e responder manualmente**.

## Três opções de visualização (escolha uma)

### Opção A — Árvore hierárquica (recomendada)

Renderiza um diagrama em árvore com `react-flow` (`@xyflow/react`, biblioteca leve já comum no ecossistema React).

```text
[#1 Tem scanner?]──Sim──▶[#2 Qual marca?]
                 └─Não──▶ (oculta #2)

[#3 Tem impressora 3D?]──Sim──▶[#4 Qual marca?]
                       │       └▶[#5 Imprime guias?]──Sim──▶[#6 Resina?]
                       └─Não──▶ (oculta #4, #5, #6)
```

- Cada nó = uma pergunta (cor diferente para Seção C "Qualificação" vs Seção D "Mapeamento").
- Cada aresta = uma regra `show_if` (label da aresta = "Sim", "Anycubic", "está preenchido", etc).
- Perguntas-raiz (sem `show_if`) ficam no topo.
- Click no nó → abre o card de edição correspondente.
- Auto-layout com `dagre` (top-down).

**Prós:** mais visual, fácil de entender, mostra ramificações.  
**Contras:** adiciona dependência (`@xyflow/react` ~80kb gzip + `dagre`).

### Opção B — Lista hierárquica indentada (zero dependência)

Renderiza uma `<ul>` recursiva: campos-raiz no nível 0, dependentes indentados embaixo do pai.

```text
#1 Tem scanner intraoral?  [Sim/Não]
   └─ se = "Sim"
      #2 Qual marca do scanner?
#3 Tem impressora 3D?  [Sim/Não]
   └─ se = "Sim"
      #4 Qual marca da impressora?
      #5 Imprime guias cirúrgicas?
         └─ se = "Sim"
            #6 Qual marca de resina?
```

- Pure HTML/CSS, sem libs novas.
- Mostra a mesma informação, só não tem o "wow" visual.

**Prós:** zero dependência, rápido, suficiente para validar lógica.  
**Contras:** menos impressionante; quando uma pergunta tem múltiplos pais (lógica OR), a árvore vira grafo e a indentação não dá conta.

### Opção C — Mermaid via `<lov-artifact>` (gerar diagrama on-demand)

Botão "Gerar diagrama" que monta um `flowchart TD` Mermaid e abre num modal.

**Prós:** visual rico, exportável, sem custo de runtime.  
**Contras:** não é editável inline, é uma "foto"; menos integrado ao editor.

## Minha recomendação

**Opção B agora, Opção A depois se precisar de mais.**

Razões:
1. Resolve 90% do "está correto?" — você bate o olho e vê a hierarquia.
2. Zero dependência nova (você já tem `@xyflow/react`? Posso confirmar; se não, evita um install só para isso).
3. Posso entregar em uma única edição num componente novo `SmartOpsFormFlowPreview.tsx`, lendo `smartops_form_fields` (mesma query que os editores já fazem) e montando a árvore a partir do campo `conditions.show_if`.
4. Se mais tarde achar pouco, troco por React Flow sem refazer nada do editor.

## Onde renderizar

Nova seção no `SmartOpsSdrCaptacaoEditor`, abaixo da Seção D, recolhível (collapsible aberto por padrão):

```
─── E ─── 👁 Pré-visualização do fluxo
[árvore renderizada aqui]
```

## Arquivos afetados (se aprovar Opção B)

- **Novo:** `src/components/SmartOpsFormFlowPreview.tsx` — componente que busca os campos e renderiza a árvore.
- **Editado:** `src/components/SmartOpsSdrCaptacaoEditor.tsx` — adicionar a Seção E renderizando o componente novo.
- Reutiliza tipos/helpers de `src/lib/formConditions.ts`.

Sem migration. Sem mudança no runtime do `PublicFormPage`.

## Pergunta antes de implementar

1. **Vai com Opção B (lista hierárquica) ou prefere a A (React Flow visual com nós e setas)?**
2. Quer que cada nó da árvore tenha um botão "Editar" que rola até o card correspondente, ou só visualização mesmo?
