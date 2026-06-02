## Objetivo

Três frentes:

1. **Broadcasts** — hoje rotulado como WhatsApp/Evolution; passar a disparar **Instagram Direct via Zernio**.
2. **Contacts** — hoje só lê `social_contacts`; precisa **sincronizar contatos do Zernio (todas as plataformas)** e expor controles de refresh/busca.
3. **LinkPicker** — já existe, mas falta aderir 100% à spec (filtro por `produto_slug`, destaque de formulário do fluxo, suporte a `send_document`/`send_buttons` e formato visual do snippet).

---

## 1) Broadcasts → Instagram DM via Zernio

### Frontend — `src/components/social/broadcasts/SocialBroadcasts.tsx`
- Cabeçalho: "Broadcasts" → subtítulo **"Disparos em massa segmentados — Instagram Direct (via Zernio)"**.
- Remover `Select` de canal (WhatsApp/IG). Fixar `channel = 'instagram_dm'`.
- Step 1 (segmento): trocar inputs de `tags`/`lead_status` por:
  - **Conta Zernio (origem do DM)** — `Select` populado por `social_zernio_accounts` (apenas `platform='instagram'` e `active=true`).
  - **Tags do contato** (vírgula, opcional).
  - **Apenas seguidores** (Switch → `is_follower=true`).
  - **Inscritos** (Switch → `subscribed=true`).
- Step 3: preview com contagem real (query em `social_contacts` filtrando pelos critérios acima).
- Botão "Disparar" → `supabase.functions.invoke('zernio-broadcast-dispatch', { body: { broadcast_id } })`.

### Backend — nova edge function `supabase/functions/zernio-broadcast-dispatch/index.ts`
- Substitui `wa-broadcast-dispatch` para fluxo IG (mantemos a função antiga viva para WA legado, sem alterar).
- Lê `social_broadcasts` por id; valida `channel='instagram_dm'`.
- Resolve público em `social_contacts` (filtros: `channel='instagram'`, `subscribed`, `is_follower`, `tags && segment.tags`).
- Para cada contato envia DM via Zernio:
  - `POST https://zernio.com/api/v1/dm` (ou endpoint correto — confirmar via `ZERNIO_API_KEY`) com `{ accountId, recipientId: ig_user_id, message }`.
  - Aplica template `{{first_name}}` / `{{name}}` a partir do `ig_username`.
  - Jitter 1–3s entre envios. Acumula `sent`/`errors`.
- Atualiza `social_broadcasts.status='sent'`, `total_sent`, `segment.errors_count`.
- Cron mode (sem `broadcast_id`): processa `status='scheduled' AND scheduled_at<=now()`.

### Banco — migration
- `social_broadcasts.segment` ganha shape `{ zernio_account_id, tags[], is_follower, subscribed, message }`. Sem mudança de schema (já é `jsonb`).
- Sem alterações de tabelas.

---

## 2) Contacts — Sync Zernio (todas as plataformas)

### Backend — nova edge function `supabase/functions/zernio-contacts-sync/index.ts`
- Para cada conta em `social_zernio_accounts` (active), pagina `GET /accounts/{id}/contacts` no Zernio.
- Upsert em `social_contacts` por `(channel, ig_user_id)` (a coluna `ig_user_id` é reaproveitada como **external_id** de qualquer plataforma; `ig_username` como handle):
  - `channel` = platform (instagram/facebook/whatsapp/tiktok).
  - `ig_user_id` = id externo retornado pelo Zernio.
  - `ig_username` = `@handle` ou nome.
  - `is_follower`, `subscribed`, `tags`, `custom_fields`, `last_seen_at` quando presentes.
  - `custom_fields.manychat_id` preservado se vier do payload (campo legacy).
- Idempotente, retorna `{ synced, per_account: [...] }`.

### Cron — `supabase/functions/wa-contact-sync-cron/index.ts` (já existe)
- Adicionar invocação periódica de `zernio-contacts-sync` (a cada 30 min) **ou** criar cron novo via `cron.schedule` (SQL no insert tool, não migration). Decisão: criar cron novo `zernio-contacts-sync-cron` para isolar do WA.

### Frontend — `src/components/social/broadcasts/SocialContacts.tsx`
- Header: "Manage contacts across all platforms (Zernio)".
- Botão **"Sincronizar Zernio"** → invoca `zernio-contacts-sync`, mostra toast com `synced`, invalida query.
- Filtro de **plataforma** (chips: Instagram / Facebook / WhatsApp / TikTok / Todas).
- Coluna extra: **Plataforma** (badge colorida por `channel`).
- Coluna extra: **ManyChat ID** (`custom_fields.manychat_id`, se houver), com cópia rápida.
- Manter busca atual (estender para `ig_username`, `ig_user_id`, `custom_fields->>manychat_id`).

---

## 3) LinkPicker — ajustes vs. spec

Arquivo: `src/components/social/flows/LinkPicker.tsx` e `src/components/social/flows/SocialFlowEditor.tsx`.

### Diferenças identificadas
- **Filtro por produto do fluxo**: hoje aceita `filterProduto` como prop, mas o `SocialFlowEditor` não passa nada. Ler `social_flows.produto_slug` do fluxo carregado e propagar para todos os usos do LinkPicker (loja + publicações). Para "formulário do fluxo", destacar visualmente (highlight + badge "Sugerido") o item cujo `titulo` ≈ `form_name`.
- **Integração ampliada**: hoje o botão "+ Adicionar um link" só aparece em `send_dm`/`send_comment_reply`. Adicionar também para:
  - `send_document` → preenche `cfg.url` (PDF).
  - `send_buttons` → cada botão ganha botão "Definir destino" abrindo LinkPicker e gravando `button.url`.
- **Formato do snippet** no `cfg.message` (já feito): manter `📎 {titulo}\nURL: {url}` e separar com `\n\n` quando já houver texto.
- **og:title opcional**: deixar comentado/no-op (não chamar edge function nova nesta rodada).

### Banco
- Não precisa mexer — `v_flow_link_picker` e `social_flow_links_manuais` já existem.

---

## Resumo de arquivos

**Editar**
- `src/components/social/broadcasts/SocialBroadcasts.tsx` — copy + canal fixo IG + segmento Zernio + dispatch para nova função.
- `src/components/social/broadcasts/SocialContacts.tsx` — botão sync, filtro plataforma, colunas plataforma/manychat_id.
- `src/components/social/flows/SocialFlowEditor.tsx` — passar `filterProduto`, expandir LinkPicker para `send_document`/`send_buttons`.
- `src/components/social/flows/LinkPicker.tsx` — destaque "Sugerido" no form do fluxo.

**Criar**
- `supabase/functions/zernio-broadcast-dispatch/index.ts`
- `supabase/functions/zernio-contacts-sync/index.ts`
- Cron job `zernio-contacts-sync-cron` (via insert tool, SQL pg_cron).

**Sem mexer**
- `wa-broadcast-dispatch` (legado WA, preservado).
- `v_flow_link_picker`, `social_flow_links_manuais`, `social_contacts` (schema).

---

## Confirmações antes de implementar

1. **Endpoint Zernio para DM e listagem de contatos** — preciso validar os paths exatos (`/dm`, `/accounts/{id}/contacts`). Se você tiver a doc/coleção da API Zernio, anexe; caso contrário, faço probe via `code--exec` com `ZERNIO_API_KEY` no início da implementação.
2. **Função `wa-broadcast-dispatch`**: manter viva ou remover? Plano atual = **manter** (não há UI WhatsApp neste módulo após a mudança, mas pode ser reutilizada por outros pontos).

Pode aprovar?
