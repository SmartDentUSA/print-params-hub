## O que está errado hoje

1. Coloquei `Link Instagram`, `Link YouTube` e `Sequência promo (7 msgs)` no editor de **fluxos do Instagram** (`/social/flows/novo` → `SocialFlowEditor.tsx`). Esses botões pertencem ao **envio para grupos WhatsApp** (`WaGroupFlowBuilder.tsx`).
2. A página **Sequências** (`SocialSequences.tsx`) só cria a régua de mensagens — não há como escolher quem entra na régua.
3. A biblioteca de sequências WhatsApp do "Sistema A" precisa ser alimentada pelo endpoint `knowledge-export-full`.

## Plano

### 1. Mover botões para o fluxo de grupos (`WaGroupFlowBuilder.tsx`)

Remover de `SocialFlowEditor.tsx` os 3 tipos: `link_instagram`, `link_youtube`, `send_promo_sequence` (e qualquer inspector/render associado).

Adicionar em `WaGroupFlowBuilder.tsx` os 3 novos `FlowNodeType`:

- `link_ig` — "Link Instagram" (ícone Instagram, rosa). Campos: `url`, `caption`. Picker = `SocialPostLinkPicker` filtrado para Instagram (já existente).
- `link_yt` — "Link YouTube" (ícone Youtube, vermelho). Campos: `url`, `caption`. Picker = SocialPostLinkPicker filtrado para YouTube.
- `promo_seq` — "Sequência promo (7 msgs)" (ícone Sparkles, roxo). Campos: `product_slug`, `product_name`, `messages: string[7]` (somente leitura, derivado do produto). Seletor abre lista de produtos sincronizados (origem: `knowledge-export-full`).

Atualizar `types.ts` (`FlowNode` union + `SocialPostNode`-like types), `wa-campaign-builder` (schema/normalização) e `wa-dispatcher`:
- `link_ig`/`link_yt`: enviar como texto único `caption\n\nurl` (mesmo padrão que `post_ig`/`post_yt`).
- `promo_seq`: expandir em 7 mensagens sequenciais (1 nó vira 7 envios) — ou inserir 6 `wait` curtos entre elas; vamos seguir o padrão atual de scheduling do `wa-dispatcher` enfileirando uma mensagem por slot com `delay_seconds` configurável (default 0, ou usar os `delays_minutes` definidos no produto).

Validação: `promo_seq` exige `product_slug` selecionado; `link_ig`/`link_yt` exigem `url`.

### 2. Seleção de público nas Sequências (`SocialSequences.tsx`)

Adicionar no diálogo "Nova sequência" uma nova seção **Público-alvo**, exibida depois do canal:

- Origem (radio): "Contatos sociais" (default p/ canal `instagram_dm`) ou "Leads CRM" (default p/ canal `whatsapp`).
- Filtros aplicados (apenas leitura visual + chips removíveis):
  - Tags (multi-select)
  - Apenas seguidores (switch, só p/ Instagram)
  - Apenas inscritos/subscribed (switch)
  - Janela de "Entrou nos últimos N dias" (slider 1-180)
- Tabela de preview (mesma DX da etapa "Contatos" dos Broadcasts): handle/nome, ID, tags, "entrou há X". Checkbox por linha + "Todos / Limpar". Limite 500.
- Contador "X selecionados de Y elegíveis".

Persistência: novos campos em `social_sequences`:
- `audience_source` text ('social_contacts' | 'crm_leads')
- `audience_filters` jsonb (tags, is_follower, subscribed, days_window)
- `audience_contact_ids` uuid[] (snapshot da seleção manual)
- `audience_count` int

Quando a sequência é ativada (Switch), uma fn edge `social-sequences-enroll` cria entradas em `social_sequence_runs` (já existe, validar) para cada contato selecionado, agendando `next_send_at` conforme `steps[0].delay_minutes`.

Validação no botão Criar: precisa ter ≥1 contato selecionado.

### 3. Biblioteca de sequências via `knowledge-export-full`

Substituir/sincronizar a "Biblioteca de Conteúdo do Sistema A" usando o endpoint informado.

- Nova fn edge `system-a-knowledge-sync` (ou ajustar a existente `system-a-content-sync`) que faz:
  ```
  GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full?limit=1000
  ```
  Para cada `product` da resposta, faz upsert em `wa_content_library` (ou tabela equivalente já em uso):
  - `slug`, `name`, `category`, `image_url`
  - `messages` (jsonb) — sequências disponíveis: `whatsapp_7msgs`, `pos_venda`, `spin`, `promo`
  - `updated_at`
- Botão "Sincronizar do Sistema A" na aba **Sequências/Biblioteca** chama essa edge.
- A lista renderiza somente produtos cujo `messages.whatsapp_7msgs` ou `messages.promo` exista (filtro para evitar ruído).
- O seletor do nó `promo_seq` (item 1) consome a mesma tabela.

## Detalhes técnicos

- `wa-dispatcher`: ao expandir `promo_seq`, lê `messages.whatsapp_7msgs[]` do `wa_content_library` pelo `product_slug` armazenado no nó (não duplica conteúdo no fluxo) — assim alterações de copy via re-sync refletem em campanhas futuras sem reedição.
- `social-sequences-enroll`: idempotente por `(sequence_id, contact_id)`.
- Migrations:
  - `ALTER TABLE social_sequences ADD COLUMN audience_source text, audience_filters jsonb DEFAULT '{}'::jsonb, audience_contact_ids uuid[] DEFAULT '{}', audience_count int DEFAULT 0;`
  - Garantir grants/RLS coerentes com o restante de `social_*`.

## Fora de escopo

- Edição visual avançada das 7 mensagens dentro do builder (sempre vêm do produto).
- Sincronização reversa (gravar mensagens no Sistema A).
- Auth do endpoint `knowledge-export-full` (assumindo público; se exigir token, adicionar secret `SYSTEM_A_TOKEN`).
