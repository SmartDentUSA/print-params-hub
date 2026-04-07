

## Fix: Loja Integrada Polling + SellFlux Tags na Timeline

### Problema 1 — Polling da Loja Integrada com Erro 400

**Linha 137** de `poll-loja-integrada-orders/index.ts` usa `order_by=-data_modificada`, mas a API da Loja Integrada não suporta esse campo no endpoint `/pedido/`. Resultado: erro 400 em todas as varreduras automáticas.

**Fix**: Trocar `-data_modificada` por `-modificado` (campo correto da API LI). Também ajustar o cursor `since_atualizado` na mesma linha 138 se necessário.

---

### Problema 2 — Tags do SellFlux não geram pontos na Timeline

Atualmente, quando tags chegam via SellFlux webhook:
- O `merge_tags_crm` RPC apenas faz UPDATE no array `tags_crm` do lead
- Um único evento genérico `sellflux_webhook_entry` é inserido no `lead_activity_log`
- **Nenhum evento individual por tag** é registrado na timeline
- O `event_timestamp` usa `new Date().toISOString()` (hora do sistema) em vez da data real do SellFlux

**Fix em 2 partes:**

#### 2a. Registrar cada tag como evento individual na timeline

No `smart-ops-sellflux-webhook/index.ts`, após o `merge_tags_crm` (linha 216), inserir um evento `lead_activity_log` para cada tag nova com:
- `event_type`: `"sellflux_tag_applied"`
- `entity_type`: `"sellflux"`
- `entity_id`: nome da tag
- `entity_name`: nome da tag formatado
- `event_data`: `{ tag: tagName, automation: automationName, source: detectedSource }`
- `event_timestamp`: timestamp real do payload SellFlux (fallback para `new Date()`)

Para extrair o timestamp real: usar `payload.created_at || payload.date || payload.timestamp || payload.updated_at` — o SellFlux envia `created_at` no payload quando disponível.

#### 2b. Corrigir timestamp do evento genérico existente

Linha 240 do webhook: trocar `new Date().toISOString()` pelo timestamp real do SellFlux (mesma lógica acima).

#### 2c. Atualizar o frontend para renderizar os novos eventos

Em `KanbanLeadDetail.tsx`, adicionar nas constantes de timeline:
- `TIMELINE_EMOJI`: `sellflux_tag_applied: "🏷️"`
- `TIMELINE_LABEL`: `sellflux_tag_applied: "Tag SellFlux aplicada"`

---

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/poll-loja-integrada-orders/index.ts` | Trocar `order_by=-data_modificada` por `-modificado` (linha 137) |
| `supabase/functions/smart-ops-sellflux-webhook/index.ts` | Adicionar inserção individual de tags na timeline + corrigir timestamp (linhas 206-242) |
| `src/components/smartops/KanbanLeadDetail.tsx` | Adicionar `sellflux_tag_applied` nos mapas de emoji/label |

### Deploy
- Deploy automático das 2 edge functions após edição

