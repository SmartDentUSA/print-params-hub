

## Fix: Sidebar da Base de Conhecimento com scroll fixo na viewport

### Problema
A lista de conteúdos na lateral esquerda cresce indefinidamente com todos os artigos, fazendo a página inteira ficar muito longa. O sidebar deveria ter scroll próprio limitado à altura da tela.

### Solução
Tornar o container do sidebar `sticky` com altura máxima da viewport e scroll interno.

### Mudanças

**`src/pages/KnowledgeBase.tsx`** (linhas 185-196)
- Adicionar `lg:sticky lg:top-4` ao wrapper do sidebar para fixá-lo durante scroll
- Adicionar `lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto` ao card interno para limitar altura e criar scroll próprio

**`src/components/KnowledgeSidebar.tsx`**
- Nenhuma mudança necessária — o scroll será controlado pelo container pai

### Resultado
- No desktop: sidebar fica fixo na tela com scroll próprio independente do conteúdo do artigo
- No mobile: comportamento não muda (empilhado normalmente)

