

# Teste de Envio WaLeads - Edge Function de Envio

## Situacao atual

- **Paulo Comercial** (`id: 1b1817af...`) esta cadastrado como vendedor ativo, mas **sem `waleads_api_key`** configurada.
- A UI de automacoes ja suporta configurar mensagens WaLeads (tipo, texto com variaveis, midia).
- O `smart-ops-cs-processor` so envia via **ManyChat**. Nao existe logica de envio WaLeads.

## O que precisa ser feito

### 1. Criar edge function `smart-ops-send-waleads`

Uma edge function dedicada para enviar mensagens via API WaLeads/ChatCenter, que:

- Recebe: `team_member_id`, `phone`, `message` (ou `media_url` + `caption`), `tipo` (text/image/audio/video/document)
- Busca a `waleads_api_key` do `team_member` no banco
- Substitui variaveis de template (`{{nome}}`, `{{produto_interesse}}`, etc.) pelos valores reais do lead
- Chama o endpoint correto da API WaLeads conforme o tipo:
  - `text` -> POST `/public/message/text`
  - `image` -> POST `/public/message/image`
  - `audio` -> POST `/public/message/audio`
  - `video` -> POST `/public/message/video`
  - `document` -> POST `/public/message/document`
- Registra o resultado na tabela `message_logs`

### 2. Atualizar `smart-ops-cs-processor` para usar WaLeads

Adicionar logica ao processador de regras CS para, quando `waleads_ativo = true`, chamar a nova funcao de envio WaLeads usando a API key do `team_member` associado a regra.

### 3. Adicionar botao "Testar Envio" na UI

Na aba Equipe ou Automacoes, um botao que permite disparar uma mensagem de teste para um numero especifico, usando as credenciais do vendedor selecionado.

---

## Detalhes tecnicos

### Edge function: `supabase/functions/smart-ops-send-waleads/index.ts`

```
Entrada (POST body):
{
  team_member_id: string,   // UUID do vendedor (busca waleads_api_key)
  phone: string,            // Numero destino (+5569...)
  tipo: "text" | "image" | "audio" | "video" | "document",
  message?: string,         // Texto (para tipo "text")
  media_url?: string,       // URL da midia
  caption?: string,         // Legenda da midia
  lead_id?: string,         // UUID do lead (para substituir variaveis e logar)
  test_mode?: boolean       // Se true, loga mas nao persiste
}
```

API WaLeads (base URL a confirmar, padrao ChatCenter):
```
POST https://api.waleads.com/public/message/{tipo}
Headers: { "Authorization": "Bearer {api_key}", "Content-Type": "application/json" }
Body (text):    { "phone": "+5511...", "message": "Ola Dr. Carlos..." }
Body (image):   { "phone": "+5511...", "url": "https://...", "caption": "Legenda" }
Body (audio):   { "phone": "+5511...", "url": "https://..." }
Body (video):   { "phone": "+5511...", "url": "https://...", "caption": "..." }
Body (document):{ "phone": "+5511...", "url": "https://...", "caption": "..." }
```

Funcao de substituicao de variaveis:
```typescript
function replaceVariables(text: string, lead: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(lead[key] || "") || `{{${key}}}`;
  });
}
```

### Atualizacao: `smart-ops-cs-processor/index.ts`

Adicionar bloco apos o envio ManyChat:
```typescript
// WaLeads sending
if (rule.waleads_ativo && lead.telefone_normalized) {
  const teamMember = await getTeamMemberForRule(rule.team_member_id);
  if (teamMember?.waleads_api_key) {
    // resolve variables, call WaLeads API
  }
}
```

### UI: Botao de teste em `SmartOpsTeam.tsx`

Adicionar um botao "Testar WaLeads" ao lado de cada vendedor que tenha `waleads_api_key`. O botao abre um dialog simples:
- Input: numero de telefone destino (pre-preenchido com o do vendedor)
- Input: mensagem de teste
- Botao "Enviar teste"
- Chama a edge function `smart-ops-send-waleads` com `test_mode: true`

---

## Pre-requisitos

1. **Paulo precisa ter a `waleads_api_key` cadastrada** na aba Equipe antes do teste
2. Precisamos confirmar a **URL base da API WaLeads** (ChatCenter) -- o padrao usado sera `https://api.waleads.com` mas pode variar

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `supabase/functions/smart-ops-send-waleads/index.ts` | Criar -- edge function de envio |
| `supabase/functions/smart-ops-cs-processor/index.ts` | Editar -- adicionar envio WaLeads |
| `src/components/SmartOpsTeam.tsx` | Editar -- botao "Testar WaLeads" |

