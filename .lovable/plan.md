## Objetivo

Construir o componente `LinkPicker` — painel lateral com 4 fontes de links (manual, loja, formulários, publicações) — e plugá-lo no editor de fluxos sociais, dentro dos nós que enviam mensagem.

## Observação importante sobre o escopo

A spec menciona a rota `/automacoes/[id]` e os tipos de nó `send_text`, `send_document`, `send_buttons`. Esses não existem no projeto hoje. O editor de fluxos atual é `/social/flows/:id` (`SocialFlowEditor.tsx`) e usa nós `send_dm`, `send_comment_reply`, `wait`, `condition`, `collect_input`, `set_tag`, `create_lead`, `end`.

Plano: implemento o LinkPicker como componente reutilizável e o integro nos nós atuais que têm campo de mensagem (`send_dm`, `send_comment_reply`). Quando os nós `send_text`/`send_document`/`send_buttons` forem criados, basta importar o mesmo componente. **Confirme se quer que eu também crie esses novos tipos de nó nesta tarefa.**

## Arquivos a criar

- `src/components/social/flows/LinkPicker.tsx` — componente principal
- `src/components/social/flows/link-picker/TabColarLink.tsx`
- `src/components/social/flows/link-picker/TabLoja.tsx`
- `src/components/social/flows/link-picker/TabFormularios.tsx`
- `src/components/social/flows/link-picker/TabPublicacoes.tsx`
- `src/hooks/social/useFlowLinkPicker.ts` — queries em `v_flow_link_picker` por `tipo`, com filtro de busca e debounce

## Arquivos a editar

- `src/components/social/flows/SocialFlowEditor.tsx` — no `NodeInspector` dos tipos `send_dm` e `send_comment_reply`, adicionar botão `+ Adicionar um link` abaixo do textarea de mensagem; ao selecionar, apenda no campo `message` e grava `link_url`, `link_titulo`, `link_tipo`, `link_thumbnail` em `cfg`.

## Comportamento do componente

Props:
```ts
{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (link: { url: string; titulo: string; tipo: 'manual'|'loja'|'formulario'|'publicacao'; thumbnail_url?: string }) => void;
  initialTab?: 'manual' | 'loja' | 'formulario' | 'publicacao';
  filterProduto?: string;
}
```

UI: `Sheet` (shadcn) lateral direito, largura 400px. Header `🔗 Adicionar link` + botão fechar. `Tabs` com 4 abas mostrando contagem dinâmica (`SELECT tipo, count(*) FROM v_flow_link_picker GROUP BY tipo`, cacheado).

### Aba "Colar link" (default)
- Lista de "Links salvos anteriormente" no topo (query `social_flow_links_manuais ORDER BY created_at DESC LIMIT 10`), cada um com botão remover (DELETE).
- Form com URL, Texto do link, Descrição (opcional), Switch "Salvar para usar em outros fluxos".
- Botão `Inserir link`: se switch ligado → `INSERT social_flow_links_manuais` antes de chamar `onSelect`.

### Aba "Loja"
- Busca com debounce 300ms + `Select` de categorias (distinct da view).
- Query `v_flow_link_picker WHERE tipo='loja' AND (titulo ILIKE %q% OR categoria ILIKE %q%) ORDER BY titulo LIMIT 50`.
- Item: thumbnail 40x40 (fallback ícone 🛒), título, host extraído da url, chevron.
- Se `filterProduto` definido, pré-preenche busca.

### Aba "Formulários"
- Sem busca. Query `WHERE tipo='formulario' ORDER BY titulo`.
- Item: ícone 📋 azul 36x36, título, host da url.

### Aba "Publicações"
- Busca debounce 300ms em `titulo` e `descricao`.
- Query `WHERE tipo='publicacao' AND (titulo ILIKE %q% OR descricao ILIKE %q%) ORDER BY titulo LIMIT 20`.
- Lista scroll max-h 280px. Item: thumbnail 44x44 (fallback 📖), título truncado 2 linhas, badge "Base de Conhecimento".

### Ao selecionar (qualquer aba)
1. Fecha o sheet.
2. Chama `onSelect({ url, titulo, tipo, thumbnail_url? })`.
3. O caller (NodeInspector) apenda no `cfg.message`:
   ```
   📎 {titulo}
   URL: {url}
   ```
   e grava `cfg.link_url`, `cfg.link_titulo`, `cfg.link_tipo`, `cfg.link_thumbnail`.

## Stack visual
- shadcn `Sheet`, `Tabs`, `Input`, `Select`, `Switch`, `ScrollArea`, `Badge`.
- Tokens semânticos (`bg-primary/10`, `border-primary`, `text-muted-foreground`) — sem cores hard-coded.
- Debounce com `setTimeout` local (sem nova dep).

## Fora de escopo
- Worker `social-flow-engine` (apenas consome `link_url` quando existir — sem alteração necessária agora).
- Extração `og:title` ao colar URL: deixo como TODO comentado (exigiria edge function de unfurl).
- Criação dos nós `send_text`/`send_document`/`send_buttons` — só se confirmado.

## Validação
- Carregar editor `/social/flows/:id`, abrir um nó `send_dm`, clicar `+ Adicionar um link`, testar as 4 abas, busca e seleção. Verificar persistência após salvar e reabrir.
