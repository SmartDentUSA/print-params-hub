## Causa raiz

`LeadDetailPanel` depende inteiramente de classes definidas em `src/styles/intelligence-dark.css` (`.intel-detail`, `.hero`, `.avatar`, `.ctx-badge`, `.ltv-block`, `.timeline-event`, etc.).

Esse CSS hoje é importado **apenas** em `src/components/SmartOpsLeadsList.tsx`:

```ts
import "@/styles/intelligence-dark.css";
```

Quando o usuário entra pela aba **Rayshape — Donos Edge Mini** (`SmartOpsRayshape.tsx`) sem antes passar pela aba "Leads", o módulo de CSS nunca é carregado. Ao clicar num card, o painel renderiza, mas sem nenhuma das classes — fica aquela "tela quebrada" que você colou: textos empilhados, sem grid, sem cards, sem tabs estilizadas.

Quando você abre primeiro a aba Leads, o CSS é injetado globalmente e depois disso o painel via Rayshape funciona normal. Por isso o bug é "às vezes".

## Correção

Adicionar o mesmo import no topo do `SmartOpsRayshape.tsx`:

```ts
import "@/styles/intelligence-dark.css";
```

Como reforço para qualquer ponto futuro que renderize o painel isoladamente, mover o import também para dentro de `src/components/smartops/LeadDetailPanel.tsx` (uma única vez — Vite deduplica) garante que o CSS acompanha o componente onde quer que seja usado.

## Arquivos alterados

- `src/components/smartops/LeadDetailPanel.tsx` — adicionar `import "@/styles/intelligence-dark.css";` no topo
- `src/components/SmartOpsRayshape.tsx` — adicionar o mesmo import (defesa em profundidade)

## Validação

- Recarregar `/admin`, ir direto em Rayshape (sem passar por Leads), clicar num card → painel deve renderizar com hero, tabs, timeline e tabelas estilizados, igual ao acesso via "Leads".

## Fora de escopo

- Nenhuma mudança de lógica, dados, queries ou views SQL.
- Nenhuma mudança no `RayshapePanel` interno (que usa estilos inline próprios).
