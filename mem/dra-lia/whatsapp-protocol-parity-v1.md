---
name: WhatsApp Protocol Parity v1
description: WhatsApp (Evolution) uses the exact same LIA protocol as the site — topic_context derived from intent, image_data passed to visual classifier, no placeholder leads, single entry point dra-lia-whatsapp
type: feature
---

**Princípio**: WhatsApp = Site. Mesma qualificação, mesmas rotas, mesma análise de imagem.

**Entry point único**: `dra-lia-whatsapp`. `smart-ops-wa-inbox-webhook` é um forwarder deprecated que só repassa para `dra-lia-whatsapp` (mantido para webhooks legados).

**`topic_context` derivado** via `_shared/wa-intent.ts → deriveTopicContext(message, intent, hasImage)`:
- `interesse_imediato | interesse_futuro | objecao | pedido_info` → `"commercial"` (dispara SPIN)
- `suporte | isSupportQuestion | isProblemReport` → `"support"`
- Regex de parâmetros (impressora/resina/cura/exposição/marcas) → `"parameters"`
- Imagem → `null` (deixa classificador visual decidir, igual ao site)

**Imagens**: download da `media_url` → base64 → passado como `image_data: { base64, mime_type }` para `dra-lia`. Nunca forçar `topic_context: "support"`.

**Sem placeholder**: WhatsApp NÃO cria mais `lia_attendances` com email `@whatsapp.lead`. Lead desconhecido → `dra-lia` roda qualificação progressiva (nome → email → tel → área → especialidade). Sessão persiste em `agent_sessions` por `session_id=wa_<digits>` com `topic_context` e `wa_phone`.

**Pre-seed**: apenas para `isRealLead` (lead com email real, não `@whatsapp.lead`). Pre-seed inclui `topic_context` no `extracted_entities`.

**Hot lead alert + sem_interesse tag** absorvidos do antigo inbox-webhook e disparados após resposta da LIA.

**Smart truncation**: > 4000 chars → corta no último parágrafo + fallback `📖 Resposta completa: <primeiro link RAG>` ou `parametros.smartdent.com.br`.