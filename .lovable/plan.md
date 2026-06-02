## Contexto

No editor de flows sociais (`SocialFlowEditor`) hoje só existem nós genéricos (Enviar DM, Aguardar, etc.) e o `LinkPicker` lê apenas da view `v_flow_link_picker` (loja/forms/base de conhecimento). Falta:

1. **Nó "Link Instagram"** — escolher de uma lista de publicações reais do Instagram (já existem 17 em `public.social_posts` com `platform='instagram'`, mais o que vem por produto em `videos.instagram[]` do endpoint `knowledge-export-full`).
2. **Nó "Link YouTube"** — mesma ideia (4 em `social_posts` + `videos.youtube[]` por produto).
3. **Nó "Mensagem Promo (7)"** — disparar a sequência de 7 mensagens promocionais por produto (igual ao exemplo da Resina Bio Vitality que o usuário colou). Hoje o endpoint público devolve essas listas em `messages.cs[]` / `messages.aftersales[]` / `messages.spin[]` por produto — atualmente quase tudo vazio, então o nó precisa funcionar para qualquer um desses buckets e degradar bem quando faltar.
4. **Histórico de postagens das contas → Grupos WA** — não existe UI hoje para selecionar posts históricos (IG/FB/YT/TikTok já sincronizados em `social_posts`) e mandar para grupos de WhatsApp. Precisa de um lugar próprio na Central de Campanhas → Grupos WA.

Tudo abaixo é frontend + um seletor leve apoiado em tabelas existentes. Nada de schema novo.

---

## Plano

### 1. Novos tipos de nó no canvas

Em `src/components/social/flows/SocialFlowEditor.tsx`, adicionar ao `NODE_TYPES`:

- `link_instagram` → "Link de publicação Instagram"
- `link_youtube` → "Link de vídeo YouTube"
- `send_promo_sequence` → "Sequência promo (7 msgs)"

Criar `NodeInspector` correspondente para cada um:

**a) `link_instagram` / `link_youtube`**

- Abre um novo seletor `SocialPostLinkPicker` (componente novo) restrito por `platform` ('instagram' ou 'youtube').
- Fonte de dados em duas abas dentro do picker:
  - **"Minhas contas"** → `supabase.from('social_posts').select('id, caption, post_url, thumbnail_url, published_at, account_id').eq('platform', X).not('post_url','is',null).order('published_at desc').limit(50)` com busca por `caption ilike`.
  - **"Do produto" (opcional)** → quando o flow tem `produto_slug`, chama `social-knowledge-fetch` (já existe) e lê `videos.instagram[]` ou `videos.youtube[]` do produto.
- Ao selecionar, grava em `cfg`: `{ url, message_prefix, thumbnail_url, caption_preview, post_id }`.
- Exibe thumbnail + caption truncada + botão "Trocar publicação".
- No tempo de execução, esses nós devem montar uma mensagem com o link (a execução real ficará para o publisher; o inspector apenas guarda config). Sem mexer no runner.

**b) `send_promo_sequence`**

- Inspector mostra:
  - Select de produto (usa `social-knowledge-fetch` para listar slugs ou cai no produto vinculado ao flow).
  - Select de "bucket": `aftersales` (default — é onde a sequência de 7 vive) | `cs` | `spin`.
  - Preview das mensagens carregadas (ordenadas por `message_order`) com contagem e checkboxes para incluir/excluir.
  - Campo "Intervalo entre mensagens (segundos)" para o runner futuro.
- Grava em `cfg`: `{ produto_slug, bucket, messages: [{order, content, enabled}], interval_seconds }`.
- Banner amarelo se o endpoint retornar 0 mensagens, sugerindo cadastrar no Sistema A.

### 2. `SocialPostLinkPicker` (componente novo)

Arquivo: `src/components/social/flows/SocialPostLinkPicker.tsx`.

- Mesma estrutura visual de `LinkPicker` (Sheet lateral, busca, ScrollArea).
- Props: `open, onOpenChange, onSelect, platform: 'instagram' | 'youtube', produtoSlug?`.
- Duas abas: **Minhas contas** (lê `social_posts`) e **Do produto** (lê endpoint via hook existente `useProductKnowledgeCopies` estendido OU chamada direta a `social-knowledge-fetch`).
- Cada item: thumbnail (fallback ícone), caption truncada (3 linhas), data, badge da plataforma. Ao clicar, devolve `{ url, titulo, thumbnail_url, tipo: 'publicacao' }`.

Não tocar no `LinkPicker` existente.

### 3. Histórico de postagens → Grupos WA

Local: aba **Grupos WA** dentro da Central de Campanhas (rota atual `/admin?sub=grupos-wa&tab=campanhas`).

Adicionar um card "Enviar publicação histórica para grupos":

- Botão "Selecionar publicação" abre o `SocialPostLinkPicker` (reaproveitado, sem filtro de plataforma — mostra IG/YT/FB/TikTok).
- Lista os grupos WA com checkboxes (lê `wa_groups`).
- Caixa de texto opcional para legenda customizada (default = `caption` do post).
- Botão "Enviar agora" → invoca edge function existente de broadcast WA (`wa-broadcast` ou `smart-ops-wa-send` — verificar qual já existe e usar) passando `{ group_ids, text, media_url }`. Se nenhuma função compatível existir, **parar e perguntar** antes de criar uma nova.

Componente: `src/components/social/broadcasts/HistoricalPostBroadcast.tsx`, montado dentro do componente atual de Grupos WA.

### 4. Persistência / tipos

- Os 3 novos `nodeType` apenas viram entradas dentro do JSONB `nodes` de `social_flows` (campo `data.config`). Nada de migração.
- Atualizar `src/lib/socialChannels.ts` apenas se houver lookup de ícones para os tipos novos — manter mudança mínima.

### 5. Fora de escopo

- Não implementar a execução runtime dos nós novos (publisher continua executando os tipos antigos; os novos viram dados aguardando o runner que o usuário pode pedir depois).
- Não criar tabela nova nem mexer em `v_flow_link_picker`.
- Não tocar em `social-caption-generator` / `social-knowledge-fetch` além de consumir o que já retorna.
- Sem mudança no `LinkPicker` legado.

---

## Detalhes técnicos

```text
SocialFlowEditor
 ├─ NODE_TYPES += [link_instagram, link_youtube, send_promo_sequence]
 └─ NodeInspector switch
      ├─ link_instagram   → <SocialPostLinkPicker platform="instagram" />
      ├─ link_youtube     → <SocialPostLinkPicker platform="youtube" />
      └─ send_promo_sequence → <PromoSequenceInspector produtoSlug={...} />

SocialPostLinkPicker
 ├─ tab "Minhas contas"  → from('social_posts')
 └─ tab "Do produto"     → social-knowledge-fetch → product.videos[platform]

Grupos WA (Central de Campanhas)
 └─ HistoricalPostBroadcast
      ├─ SocialPostLinkPicker (sem filtro)
      ├─ checkboxes wa_groups
      └─ invoke wa-broadcast (verificar nome real)
```

Fonte de dados de `messages.spin[]` / `aftersales[]` / `cs[]` por produto: `POST https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full` com `{ slug }` ou filtrando a lista — já chamado por `social-knowledge-fetch`.

## Arquivos afetados

- `src/components/social/flows/SocialFlowEditor.tsx` — novos `NODE_TYPES` + branches no `NodeInspector`
- `src/components/social/flows/SocialPostLinkPicker.tsx` — novo
- `src/components/social/flows/PromoSequenceInspector.tsx` — novo (ou inline no editor)
- `src/components/social/broadcasts/HistoricalPostBroadcast.tsx` — novo
- Componente atual da aba "Grupos WA" — montar o card novo (identificar arquivo após aprovação do plano)
