

## Diagnóstico

O problema está na linha 51-52 do `smart-ops-send-waleads/index.ts`:

```typescript
const templateId = sellflux_template_id || message;  // ← message vira "templateId"
const useSellFlux = SELLFLUX_WEBHOOK_CAMPANHAS && templateId && phone;  // ← sempre true
```

Como `SELLFLUX_WEBHOOK_CAMPANHAS` existe e `message` (texto livre do handoff) faz fallback para `templateId`, **toda mensagem vai para o SellFlux** em vez do WaLeads. O SellFlux rejeita porque recebe texto livre como se fosse um template ID, mas retorna status 200 — logo o sistema marca como "enviado" quando na verdade falhou.

Segundo bug: na linha 1553 do `dra-lia`, o `lead_status` preserva o valor antigo quando `piperun_id` existe.

## Correções

### 1. `supabase/functions/smart-ops-send-waleads/index.ts`

**Separar SellFlux (só para templates) do WaLeads (mensagens diretas):**

- SellFlux só é usado quando `sellflux_template_id` é explicitamente fornecido
- Mensagens de texto livre sempre vão via WaLeads API diretamente
- Remover o fallback `sellflux_template_id || message`

```typescript
// ANTES (bugado):
const templateId = sellflux_template_id || message;
const useSellFlux = SELLFLUX_WEBHOOK_CAMPANHAS && templateId && phone;

// DEPOIS (corrigido):
const useSellFlux = SELLFLUX_WEBHOOK_CAMPANHAS && sellflux_template_id && phone;
```

### 2. `supabase/functions/dra-lia/index.ts`

**Forçar `lead_status = "em_atendimento"` no handoff** (linha 1553):

```typescript
// ANTES:
lead_status: attendance.piperun_id ? attendance.lead_status || "em_atendimento" : "em_atendimento"

// DEPOIS:
lead_status: "em_atendimento"
```

### Deploy
- Redeploy `smart-ops-send-waleads` + `dra-lia`

