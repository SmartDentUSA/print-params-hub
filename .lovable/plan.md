

## Dois bugs criticos encontrados

### Bug 1: Mensagem de escalonamento enviada AO LEAD (nao ao vendedor)
**Linha 2277**: `const leadPhone = attendance.telefone_normalized` — a notificacao interna de escalonamento esta sendo enviada para o telefone do LEAD em vez do telefone do VENDEDOR (`teamMember.whatsapp_number`).

O lead Rita recebeu a mensagem "🔴 ESCALONAMENTO URGENTE" porque o codigo envia para `leadPhone` em vez de `teamMember.whatsapp_number`.

**Fix**: Trocar `leadPhone` por `teamMember.whatsapp_number` na linha 2277 e no `fetch` da linha 2290.

### Bug 2: Mensagens de agradecimento disparam escalonamento
**Linhas 2164-2174**: O check de historico dispara `especialista` quando 2+ das ultimas 3 respostas da LIA contem frases de fallback, sem filtrar mensagens de encerramento como "Obrigado".

**Fix**: Adicionar guard clause no inicio de `detectEscalationIntent` para retornar `null` em mensagens de agradecimento/encerramento.

### Implementacao

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | `supabase/functions/dra-lia/index.ts` linha 2277 | Trocar `attendance.telefone_normalized` por `teamMember.whatsapp_number` |
| 2 | `supabase/functions/dra-lia/index.ts` linha 2156 | Adicionar guard clause para mensagens de encerramento antes do check de historico |
| 3 | Deploy da edge function |

### Detalhe das mudancas

**Mudanca 1** (linha 2277-2281):
```typescript
// ANTES (ERRADO — envia ao lead):
const leadPhone = attendance.telefone_normalized;

// DEPOIS (CORRETO — envia ao vendedor):
const sellerPhone = teamMember.whatsapp_number;
```

**Mudanca 2** (linha 2156, dentro de `detectEscalationIntent`):
```typescript
// Guard: mensagens de agradecimento/encerramento nunca disparam escalonamento
const closingPattern = /^(obrigad[oa]s?|valeu|ok|beleza|entendi|perfeito|legal|blz|vlw|thanks?|thank you|gracias?|tudo bem|certo|massa|show|top|boa|bacana|ta bom|tá bom|combinado|pode ser|fechou|tranquilo)\b/i;
if (closingPattern.test(message.trim())) {
  return null;
}
```

