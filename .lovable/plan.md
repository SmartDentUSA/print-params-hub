## Problema

O editor "Nova campanha" em `Grupos WA` (`WaGroupFlowBuilder.tsx`) é separado do `SocialFlowEditor` (onde os nós Instagram/YouTube já existem). Por isso, na sidebar `ADICIONAR NÓ` aparecem só: Mensagem, Aguardar, IA+Conteúdo, Imagem, Vídeo, Áudio, Documento, Link, Botões, Lista, Carrossel — sem Postagens IG/YT.

## Escopo

Adicionar dois novos tipos de nó **`post_ig`** e **`post_yt`** ao builder de campanhas WA, alimentados pelo histórico já existente em `social_posts` (Instagram, YouTube). Sem mexer em CRM, sync ou lógica de negócio.

## Alterações

### 1. `src/components/smartops/wa-groups/types.ts`
- Estender `FlowNodeType` com `"post_ig" | "post_yt"`.
- Nova interface `SocialPostNode`:
  ```ts
  { id, type: "post_ig" | "post_yt",
    social_post_id?: string,   // id em social_posts (referência)
    post_url: string,          // link da publicação
    caption?: string,          // texto a enviar (vem do post; editável)
    thumbnail_url?: string,    // preview no card
    titulo?: string }
  ```
- Acrescentar a união em `FlowNode`.

### 2. `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx`
- Importar `Instagram`, `Youtube` do `lucide-react`.
- Adicionar entradas em `nodeMeta`:
  - `post_ig: { label: "Postagem Instagram", icon: Instagram, color: "text-pink-600", isNew: true }`
  - `post_yt: { label: "Postagem YouTube",  icon: Youtube,   color: "text-red-600",  isNew: true }`
- `newNode()`: criar nó vazio (`post_url:""`, `caption:""`).
- Renderizador de nó: cartão com thumb + título + link e botões "Selecionar publicação" / "Trocar". O botão abre o `SocialPostLinkPicker` já existente (`src/components/social/flows/SocialPostLinkPicker.tsx`) filtrado por plataforma (`platform: "instagram" | "youtube"`).
- Ao escolher, preencher `social_post_id`, `post_url`, `caption`, `thumbnail_url`, `titulo`. Permitir editar `caption` (Textarea) — texto final que vai para o grupo.

### 3. `src/components/social/flows/SocialPostLinkPicker.tsx`
- Aceitar prop opcional `platform?: "instagram" | "youtube"` para pré-filtrar a aba "Minhas contas" (já lê `social_posts`).

### 4. `supabase/functions/wa-dispatcher/index.ts` (linha ~125, `switch item.node_type`)
- Adicionar dois cases que reaproveitam o handler de `link`:
  - `case "post_ig":` e `case "post_yt":` → montar payload de link Evolution com `title = node.titulo || "Publicação"`, `description = node.caption?.slice(0, 400)`, `url = node.post_url`. Se preferir imagem com legenda (quando `thumbnail_url` existir), enviar como image+caption. Manter `mention_all=false`.
- Sem nova tabela; o dispatcher só lê do `flow_json`.

### 5. `supabase/functions/wa-campaign-builder/index.ts` (se existir validação por tipo)
- Aceitar os dois novos tipos na validação de schema (`post_ig`, `post_yt`) — campos obrigatórios: `post_url`.

## Fora de escopo

- Biblioteca de Conteúdo Sistema A (sequências CS/aftersales/promo) — depende de endpoint adicional do Sistema A e está em outra thread.
- SMS para número avulso — pendente decisão.
- `SocialFlowEditor` (DM Instagram) já tem os nós `link_instagram`/`link_youtube`; este plano só replica a ideia no builder de Grupos WA.

## Validação

- Abrir `/admin?sub=grupos-wa&tab=campanhas` → Nova campanha → sidebar deve mostrar "Postagem Instagram" e "Postagem YouTube".
- Adicionar nó IG, escolher post existente → cartão mostra thumb + caption editável.
- Salvar campanha → conferir `wa_campaigns.flow_json` com `type:"post_ig"` e `post_url` populado.
- Disparar no grupo de teste → mensagem de link/imagem com URL do post chega corretamente.
