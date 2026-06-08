## Escopo

Mexer **apenas** em `supabase/functions/zernio-broadcast-dispatch/index.ts`. Não tocar em `zernio-webhook`, `zernio-contacts-sync`, `zernio-metrics-sync`, `zernio-accounts-sync`, nem em tabelas/RLS.

## Problema

Broadcast `dann` (IG Direct) ficou `failed` com `total_sent: 0`. A função criou o draft na Zernio com sucesso (`zernio_broadcast_id` retornado), mas o passo `POST /broadcasts/{id}/recipients` anexou **0 contatos** de 46, e o `/send` respondeu "Broadcast has no recipients". O erro real do passo de recipients está sendo engolido (só `console.error`), então não dá pra ver o motivo na UI nem nos registros do `social_broadcasts`.

## Plano (2 etapas, função única)

### Etapa 1 — Instrumentação e fail-fast

Editar `zernio-broadcast-dispatch/index.ts`:

1. No loop de recipients (linhas ~170–180):
   - Logar `status` + body da resposta da Zernio em **toda** iteração (não só em erro).
   - Acumular num array `recipientErrors[]` o `{ status, body, chunk_size }` de cada chunk que retornar `!ok` **ou** `added === 0`.
2. Após o loop, **antes** de chamar `/send`:
   - Se `added === 0`, marcar `status='failed'`, gravar em `segment.recipient_errors` o array coletado + `segment.zernio_broadcast_id` (pra rastrear o draft órfão), e retornar 502 sem chamar `/send`.
3. Manter o comportamento atual quando `added > 0`.

### Etapa 2 — Disparo de teste e correção dirigida

1. Recriar o broadcast `dann` apertando o botão de re-disparo (ou criar um novo de teste com 1–2 contatos pela UI).
2. Ler `social_broadcasts.segment.recipient_errors` + edge function logs.
3. Aplicar a correção exata conforme a mensagem da Zernio. Hipóteses prováveis (vou confirmar pela resposta real, não chuto):
   - Nome do campo do payload (`contactIds` vs `contacts` vs `ids`).
   - ID errado sendo enviado (Zernio `_id` vs `platformIdentifier`).
   - Mismatch de `accountId`/`profileId` entre contato e draft.
4. Reenviar o broadcast e confirmar `total_sent > 0`.

## O que NÃO faço

- Não altero sync de contatos, webhook, métricas, contas, nem qualquer tabela.
- Não mexo em `wa-broadcast-dispatch` (WhatsApp).
- Não apago o broadcast falhado existente.
