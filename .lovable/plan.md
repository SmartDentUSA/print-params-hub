## Objetivo

Reformular a tela `/social/novo` para ficar igual ao mLabs (linha compacta de 14 ícones de canal+formato), trazer o **seletor de produto** para antes do botão "Criar legenda – IA", e garantir que o produto fique gravado no post e que as postagens fiquem acessíveis para Dra. LIA e Copilot.

---

## 1. Novo seletor de canais (estilo mLabs)

**Arquivo:** `src/components/social/editor/steps/StepChannels.tsx` (substituir cards atuais)

Trocar a grid de 6 cards genéricos por uma **linha horizontal de 14 ícones canal+formato**, exatamente como a referência:

| # | Ícone | Canal+formato interno |
|---|---|---|
| 1 | Instagram (gradient) | `instagram` / Feed |
| 2 | Instagram tracejado | `instagram` / Stories |
| 3 | Claquete IG | `instagram` / Reels |
| 4 | Facebook "f" | `facebook` / Post |
| 5 | Facebook tracejado | `facebook` / Stories |
| 6 | Claquete FB | `facebook` / Reels |
| 7 | X / Twitter | `twitter` / Post (novo) |
| 8 | YouTube play | `youtube` / Vídeo |
| 9 | YouTube Shorts (raio) | `youtube` / Shorts |
| 10 | Pinterest "P" | `pinterest` / Image Pin |
| 11 | Google Meu Negócio | `gmb` / Update (novo) |
| 12 | Galeria | `gallery` / placeholder |
| 13 | TikTok | `tiktok` / Vídeo |
| 14 | LinkedIn "in" | `linkedin` / Post (novo) |

Comportamento:
- Cada botão é toggle independente. Quando **ativo**, ícone aparece colorido (brand HEX); quando **inativo**, em `text-muted-foreground` (cinza), igual ao print.
- Selecionar um ícone cria/remove um `ChannelInput` com `platform` + `format` já pré-definidos (o "formato" deixa de ser dropdown obrigatório porque o próprio ícone já o representa).
- Configuração específica por canal (título do YouTube, board do Pinterest, etc.) continua aparecendo abaixo apenas para canais ativos que precisam.

**Arquivos a atualizar para suportar novos canais:**
- `src/lib/socialChannels.ts` — adicionar `twitter`, `linkedin`, `gmb`, `gallery` no `SocialPlatform`, no `SOCIAL_CHANNELS` e no `SOCIAL_BRAND_HEX`.
- `src/lib/social/postSchema.ts` — incluir novos valores no enum `platform`.
- Criar `src/components/social/editor/ChannelFormatIcon.tsx` com SVGs inline (gradiente IG, "f" do Facebook, raio do YT Shorts, "P" do Pinterest, fachada do GMB, "in" do LinkedIn, etc.). Para evitar dependências, usaremos SVGs simples no estilo dos ícones do print (sem usar lucide para os que não existem).

A faixa fina no topo da seção "Texto do post" (a aba "Todos · IG · LI · TT · ..." vista no print) será gerada a partir dos canais ativos: um filtro de preview por canal que mostra qual conjunto de texto/hashtags está sendo editado (sem mudar o backend — por enquanto compartilhado entre canais).

---

## 2. Seletor de produto antes de "Criar legenda – IA"

**Arquivo:** `src/components/social/editor/steps/StepContent.tsx`

- Remover os campos manuais "Produto (nome)" e "Slug do produto" que estão no final da etapa.
- Inserir, **dentro do card "Gerar com IA"**, antes do botão de gerar, um campo:

  > **Produto da publicação** *(obrigatório para gerar com IA)*
  > `<SearchableProductSelect />` carregando `system_a_catalog` (ativos) + `resins` (ativos).

- Ao escolher, popular automaticamente `product_name` + `product_slug` no `PostInput`, e gravar também `product_ref` no formato `product:<id>` ou `resin:<id>`.
- O botão "Criar legenda + hashtags + 1º comentário" só fica habilitado se houver produto selecionado (instruções continuam opcionais para dar ângulo).

Hook `useCatalogProducts` e `useSupabaseData` (resinas) já existem e serão reutilizados.

---

## 3. Persistir o produto na postagem e no banco

**Migration nova:** `supabase/migrations/<timestamp>_social_posts_product.sql`

```sql
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS product_ref text,        -- "product:<uuid>" | "resin:<uuid>"
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_slug text,
  ADD COLUMN IF NOT EXISTS product_category text;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_product_ref ON public.scheduled_posts (product_ref);
```

Atualizações:
- `src/hooks/social/useCreateScheduledPost.ts` e `useUpdateScheduledPost.ts` → enviar os novos campos.
- `src/components/social/SocialPostCard.tsx` e `SocialPostsBank.tsx` → exibir badge "Produto: X" quando preenchido.
- `social-caption-generator` (edge) já recebe `product_name`/`product_slug`; nenhuma mudança ali além de aceitar o `product_ref` opcional para log.

---

## 4. Expor postagens para Dra. LIA e Copilot

**A) View consolidada para RAG/consulta:**

```sql
CREATE OR REPLACE VIEW public.v_social_posts_for_ai AS
SELECT
  sp.id,
  sp.scheduled_at,
  sp.status,
  sp.product_ref,
  sp.product_name,
  sp.product_slug,
  sp.caption,
  sp.hashtags,
  sp.first_comment,
  sp.channels,        -- jsonb
  sp.media_items
FROM public.scheduled_posts sp
WHERE sp.status IN ('scheduled','published');

GRANT SELECT ON public.v_social_posts_for_ai TO authenticated, service_role;
```

**B) Ferramenta nova no Copilot** (`supabase/functions/_shared/copilot-tools` ou equivalente — local atual de `search_knowledge_*`):

- `search_social_posts({ product?, channel?, status?, limit })` — RPC ou query direta sobre a view acima, retorna até 20 posts com `product_name`, `caption`, `hashtags`, `channels[].platform`, `scheduled_at`, `status`.
- Registrar a tool no array de tools do `smart-ops-copilot/index.ts` e atualizar `mem://smart-ops/copilot-rag-access-v1` para listar a nova capability.

**C) Indexação para Dra. LIA (RAG):**

- Adicionar trigger pós-publish em `scheduled_posts` que gera um chunk em `agent_embeddings` com:
  - `source_type = 'social_post'`
  - `chunk_text = caption || ' ' || first_comment || ' ' || hashtags`
  - `metadata = { product_slug, product_name, channels, scheduled_at, post_id }`
- Dessa forma, `match_agent_embeddings` (já usado por Dra. LIA e por `social-caption-generator`) passa a recuperar posts antigos como referência.

---

## 5. Memória / docs

- Atualizar `mem://strategy/ai-marketing-strategy-framework` mencionando que social posts agora têm `product_ref` obrigatório e são indexados.
- Criar `mem://features/social-publisher-channel-format-icons` documentando a paleta de 14 ícones (canal+formato) e a regra "cinza = inativo, brand HEX = ativo".

---

## Fora de escopo

- Conectores reais Twitter/X, LinkedIn, GMB, "galeria" (apenas UI/persistência por enquanto; publish real continua nos canais já conectados).
- Mudanças no preview lateral do mLabs (mantemos o `SocialPostPreview.tsx` atual).
- Reescrever `social-caption-generator` (já migrado para `ai-router`).

---

## Critérios de aceitação

1. `/social/novo` mostra linha horizontal com 14 ícones; inativos em cinza, ativos em cor da marca.
2. Card "Gerar com IA" exige seleção de produto via dropdown buscável; sem produto, botão desabilitado.
3. Post salvo grava `product_ref`, `product_name`, `product_slug` em `scheduled_posts`.
4. Card de post (lista + banco) mostra badge com o produto.
5. Copilot consegue responder "quais posts publicamos sobre BLZ INO 200?" usando a nova tool.
6. Dra. LIA recupera caption/hashtags como contexto RAG quando o usuário pergunta sobre comunicação do produto.
