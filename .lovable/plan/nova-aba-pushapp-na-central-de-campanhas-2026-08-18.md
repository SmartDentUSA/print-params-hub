# Nova aba PushApp na Central de Campanhas

Objetivo: enviar notificações push (Web Push) para clientes/leads que instalaram o app (PWA) e autorizaram notificações, com segmentação, mensagem personalizada, envio imediato ou agendado.

## O que o usuário vai ver

Nova aba **PushApp** ao lado de "Anúncios", com 3 blocos:

1. **Segmentação de usuários** — mesmos campos já usados em "Criar Campanha" (produto de interesse, temperatura, etapa do funil, especialidade, área de atuação, UF/cidade, vendedor, status real, tem scanner/impressora, recência, cliente ou não, LTV mínimo, score mínimo, origem, formulário etc.), mais dois filtros exclusivos de push:
   - somente usuários com push ativo (obrigatório)
   - plataforma: Android/Chrome, iOS (PWA), Desktop
   Contador ao vivo: "X usuários com push ativo nesta segmentação". Também dá para carregar/salvar segmentações (reaproveita `campaign_segments`).

2. **Mensagem** — título (até 60 caracteres), corpo (até 160), imagem/ícone opcional, link de destino (URL ou link curto interno), e variáveis personalizadas `{{nome}}`, `{{primeiro_nome}}`, `{{cidade}}`, `{{produto_interesse}}` com pré-visualização de como o push aparece no celular.

3. **Envio** — "Enviar agora" ou "Programar" (data/hora, respeitando a janela 06:00–23:00 já usada nas outras automações). Depois do envio: card com enviados, entregues, cliques e falhas, e histórico das campanhas push anteriores.

## Como o usuário passa a receber push

- O app ganha um service worker e um convite discreto ("Receber avisos da Smart Dent") no portal do cliente, exibido após o login por celular.
- Ao aceitar, o navegador registra a assinatura e ela fica vinculada ao lead que está logado — é isso que permite segmentar depois.
- No iPhone o push só funciona se o cliente adicionar o site à tela de início; a tela de convite explica isso quando detecta iOS.

## Detalhes técnicos

**Banco (migration)**
- `push_subscriptions`: `id`, `lead_id`, `user_id`, `endpoint` (único), `p256dh`, `auth`, `platform`, `user_agent`, `enabled`, `last_seen_at`, `created_at`. GRANT para `authenticated` (insert/update próprio) e `service_role`; RLS por `auth.uid()`.
- `push_campaigns`: título, corpo, ícone, url, `filters` jsonb, `schedule_at`, `status` (`rascunho|agendada|enviando|enviada|erro`), contadores `total`, `sent`, `failed`, `clicked`, `created_at`.
- `push_send_log`: `campaign_id`, `subscription_id`, `lead_id`, `status`, `error`, `sent_at`, `clicked_at`, `dedupe_hash`.
- RPC `fn_count_push_audience(filters jsonb)` reaproveitando a mesma lógica de filtro de leads das campanhas, com join em `push_subscriptions` (`enabled = true`) e sempre `merged_into IS NULL`.

**Secrets**
- `VAPID_PUBLIC_KEY` (também exposta ao front via endpoint público), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Edge Functions**
- `push-subscribe` — registra/atualiza/remove a assinatura do usuário logado (valida JWT, resolve `lead_id`).
- `push-campaign-send` — monta o público pela segmentação, personaliza as variáveis por lead, assina o payload VAPID (`npm:web-push`), envia em lotes, grava `push_send_log`, remove assinaturas com 404/410 e registra o evento na timeline do lead (`lead_activity_log`, `event_type: push_sent`).
- `push-campaign-cron` — roda de 5 em 5 minutos e dispara as campanhas com `schedule_at` vencido.
- `push-click` — registra o clique e redireciona para a URL final.

**Frontend**
- `public/sw.js` com handlers `push` e `notificationclick`; registro do service worker no `main.tsx`.
- `src/hooks/usePushSubscription.ts` — permissão, registro, estado.
- `src/components/campaigns/PushAppTab.tsx` — segmentação + mensagem + envio + histórico.
- `src/components/PushOptInBanner.tsx` — convite montado no portal do cliente.
- Nova `TabsTrigger value="pushapp"` em `SmartOpsCampaigns.tsx`.

Nenhuma alteração nas abas, automações WhatsApp/SMS/e-mail ou funis existentes.
