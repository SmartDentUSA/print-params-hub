## Objetivo
Adicionar um campo de busca no topo do painel **Gerenciar Base de Conhecimento** (admin) que filtra os conteúdos listados em todas as categorias (A–G + ROI) por título, slug e excerpt em tempo real.

## Onde
- Componente: `src/components/AdminKnowledgeHub.tsx` (painel admin que renderiza as pills A•Vídeos, B•Falhas, … G•Catálogo, F•Calculadora ROI e a lista de conteúdos abaixo).

Preciso primeiro abrir o arquivo para confirmar a estrutura exata do estado (lista de conteúdos, categoria ativa) antes de decidir se o filtro vive no estado local do Hub ou se passamos a query como prop para o sub-listador.

## Mudanças
1. Adicionar `useState<string>('')` para `search` no topo do componente.
2. Renderizar um `<Input>` (shadcn) com ícone `Search` (lucide), placeholder "Buscar por título, slug ou trecho…", logo abaixo do título "Gerenciar Base de Conhecimento" e acima/ao lado das pills de categoria.
3. Filtrar a lista exibida com:
   ```ts
   const q = search.trim().toLowerCase();
   const filtered = !q ? items : items.filter(c =>
     c.title?.toLowerCase().includes(q) ||
     c.slug?.toLowerCase().includes(q) ||
     c.excerpt?.toLowerCase().includes(q)
   );
   ```
4. Quando `search` tiver valor, ignorar o filtro de categoria selecionada (busca global em todos os conteúdos carregados) e mostrar um chip "Limpando filtro de categoria" + botão "x Limpar".
5. Estado vazio: se `filtered.length === 0 && q`, exibir "Nenhum conteúdo encontrado para '{q}'".
6. Debounce leve (150ms) opcional — só se a lista for grande; caso contrário filtro síncrono.

## Não-objetivos
- Não altera a busca pública (`/base-conhecimento`).
- Não altera schema, RPC, nem edge functions.
- Não toca em vídeos/catálogo separados — somente a listagem de conteúdos do Hub admin.

## Validação
- Digitar termo → lista filtra instantaneamente em todas as categorias.
- Apagar termo → volta ao comportamento normal (filtro por pill).
- Sem termo + clique em pill → comportamento atual preservado.
