

# Histórico Completo de Conversas no Card do Lead

## Problema
O card de detalhe do lead (`KanbanLeadDetail`) atualmente só mostra mensagens de `message_logs` (sistema→vendedor e vendedor→lead). As conversas reais entre a LIA e o cliente — armazenadas em `agent_interactions` (web) e `whatsapp_inbox` (WhatsApp) — não aparecem.

## Solução
Adicionar duas novas seções ao `KanbanLeadDetail`:

1. **💬 Conversas LIA** — busca `agent_interactions` pelo `lead_id` do lead, mostrando pares `user_message` / `agent_response` com timestamp
2. **📱 WhatsApp Inbox** — busca `whatsapp_inbox` pelo `lead_id`, mostrando mensagens inbound/outbound com intent detectado

### Fluxo de dados

```text
Lead abre card
  ├─ agent_interactions WHERE lead_id = lead.id (ORDER BY created_at DESC, LIMIT 100)
  ├─ whatsapp_inbox WHERE lead_id = lead.id (ORDER BY created_at DESC, LIMIT 100)  
  └─ message_logs WHERE lead_id = lead.id (já existe)
```

### UI

Cada conversa LIA mostra:
- Timestamp
- Mensagem do cliente (bolha esquerda, cinza)
- Resposta da LIA (bolha direita, azul)
- Badge de feedback se houver (👍/👎)

Cada mensagem WhatsApp Inbox mostra:
- Timestamp + direction (inbound/outbound)
- Texto da mensagem
- Badge com intent detectado

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/components/smartops/KanbanLeadDetail.tsx` | Adicionar fetch de `agent_interactions` e `whatsapp_inbox` por `lead_id`. Criar seções "Conversas LIA" e "WhatsApp Inbox" com layout de chat |

### Observações
- `agent_interactions` já tem coluna `lead_id` (uuid, nullable) — usado pela `dra-lia` para associar interações ao lead
- `whatsapp_inbox` já tem coluna `lead_id` — preenchido pelo webhook
- Ambas as tabelas têm RLS que permite leitura por admins (que é quem acessa o Kanban)
- Limite de 100 mensagens por seção para performance

