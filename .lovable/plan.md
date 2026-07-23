## Objetivo

Ocultar por padrão o item **"Visão geral"** da navegação lateral da Base de Conhecimento e adicionar um toggle no **Editor HUB** (Configurações do Sistema) para exibir/ocultar.

## Mudanças

### 1. `src/components/AdminKbHubEditor.tsx`
- Adicionar uma nova chave de setting `kb_nav_show_overview` (string `"true"`/`"false"`, padrão `"false"`).
- Novo card no topo do editor: **"Navegação da Sidebar"** com um switch:
  - "Mostrar item 'Visão geral' na navegação" (default: desligado)
- Exportar `KB_NAV_SHOW_OVERVIEW_KEY` para reuso.

### 2. `src/pages/KnowledgeBase.tsx`
- Ler o setting `kb_nav_show_overview` via `fetchSetting` na montagem.
- Passar prop `showOverview: boolean` (default false) para `KbShellSidebar`.
- Se `showOverview === false` **e** estado inicial seria `overview`, cair para a aba padrão (`catalogo` ou primeira disponível) — assim o usuário nunca fica preso numa view escondida.

### 3. `src/components/knowledge/shell/KbShellSidebar.tsx`
- Aceitar prop opcional `showOverview?: boolean` (default `false`).
- Filtrar o item `overview` da lista `NAV` quando `showOverview !== true`.

## Fora de escopo
- Nenhuma mudança em backend, RLS, ou dados.
- Comportamento do hero "overview" (título/subtítulo) permanece; apenas o botão de navegação é ocultado.
