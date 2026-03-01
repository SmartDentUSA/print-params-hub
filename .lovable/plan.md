

## Diagnóstico

A função `notifySellerHandoff` atual faz **apenas 1 das 3 coisas** necessárias:

| Ação | Status |
|------|--------|
| Notificar vendedor via WhatsApp | Funciona (envia msg para o WhatsApp do vendedor) |
| Enviar mensagem DO vendedor PARA o lead | NAO EXISTE |
| Atualizar dados do lead no CRM (tags, etapa) | PARCIAL (tags_crm e ultima_etapa_comercial, mas não sincroniza com PipeRun) |

Além disso, a detecção de "não sei" pós-LLM (IDK_PATTERNS) **ainda não foi implementada** — o handoff só dispara quando RAG retorna zero resultados.

---

## Plano de Implementação

### 1. Detecção pós-stream de respostas "não sei" (IDK_PATTERNS)

No bloco `[DONE]` (linha ~4438), após salvar `agent_response`, adicionar regex para detectar frases como:
- "não tenho a informação", "não está disponível nos meus dados", "vou confirmar com o time", "nossa equipe pode te informar"

Se detectado + lead identificado → disparar `notifySellerHandoff` + `upsertKnowledgeGap` fire-and-forget.

### 2. Mensagem do vendedor para o lead

Dentro de `notifySellerHandoff`, após enviar a notificação ao vendedor, adicionar um segundo envio via `smart-ops-send-waleads` — desta vez para o **telefone do lead**, usando as credenciais do vendedor:

```text
Olá {nome}! Aqui é o(a) {vendedor} da BLZ Dental. 😊
Vi que você tem uma dúvida sobre "{pergunta}".
Vou buscar essa informação e te retorno em breve!
Qualquer coisa, estou à disposição. 🦷
```

Isso garante que o lead recebe uma mensagem **do número do vendedor**, criando o vínculo direto.

### 3. Atualização completa do CRM no lead

Expandir as atualizações em `lia_attendances`:
- `tags_crm`: adicionar `A_HANDOFF_LIA` (já existe)
- `ultima_etapa_comercial`: setar `handoff_lia_vendedor` (já existe)
- `temperatura_lead`: setar `quente` (quando IDK em conversa ativa = lead engajado)
- `lead_status`: manter ou atualizar para `em_atendimento`

Se o lead tem `piperun_id`, disparar fire-and-forget para `smart-ops-sync-piperun` para sincronizar as tags e etapa no PipeRun externo.

### 4. Registro na whatsapp_inbox

A mensagem outbound para o lead será registrada automaticamente em `whatsapp_inbox` (já existe lógica no `smart-ops-send-waleads`).

---

## Arquivo Alterado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | +IDK_PATTERNS no bloco [DONE], +envio seller→lead em `notifySellerHandoff`, +sync PipeRun, +update temperatura_lead |

---

## Resumo do Fluxo Completo

```text
Lead pergunta → LLM responde "não tenho essa informação"
  ↓
IDK_PATTERNS detecta no [DONE]
  ↓
notifySellerHandoff() dispara:
  1. Msg WhatsApp → VENDEDOR (briefing completo)
  2. Msg WhatsApp → LEAD (do número do vendedor: "vou buscar a info")
  3. Update lia_attendances (tags, etapa, temperatura)
  4. Sync PipeRun (se piperun_id existe)
  5. Registra knowledge_gap
  6. Registra em message_logs + whatsapp_inbox
```

