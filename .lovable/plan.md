

## Problema

Os logs mostram claramente: o ChatCenter dispara o webhook **repetidamente** com o mesmo `lastMessage: "Oi"` e `lastMessageDate: "2026-02-27T15:59:37.000Z"` (timestamp antigo). Cada disparo gera uma nova chamada a Dra. LIA e uma nova resposta. A janela de dedup atual (5s em outbound) nao e suficiente porque os disparos vem em rajada rapida.

## Solucao: Duas protecoes em `dra-lia-whatsapp/index.ts`

### 1. Filtro de recencia (lastMessageDate)
Extrair `combinedCardCustomer.lastMessageDate` do payload. Se a diferenca entre `now()` e esse timestamp for > 2 minutos, ignorar com `{ ignored: true, reason: "stale_message" }`.

### 2. Deduplicacao por conteudo (phone + hash da mensagem)
Antes de processar, consultar `whatsapp_inbox` para ver se ja existe um registro **inbound** com o mesmo `phone_normalized` e `message_text` nos ultimos 5 minutos. Se sim, ignorar com `{ ignored: true, reason: "duplicate_content" }`.

### Passos de implementacao

1. **Extrair `lastMessageDate`** do payload ChatCenter em `extractFields` ou apos ele
2. **Adicionar check de recencia**: comparar `lastMessageDate` com `Date.now()`, se > 120000ms, retornar ignored
3. **Adicionar check de duplicata**: query `whatsapp_inbox` WHERE `phone_normalized = X` AND `message_text = Y` AND `direction = 'inbound'` AND `created_at > now() - 5min`, se encontrar, retornar ignored
4. **Aumentar janela de dedup outbound** de 5s para 30s como protecao extra
5. **Deploy** da edge function

