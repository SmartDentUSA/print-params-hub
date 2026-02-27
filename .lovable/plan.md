

## Analise do Screenshot

O webhook do ChatCenter ja esta configurado apontando para a edge function (`https://okeogjgqijbfkudfjadz.supabase.co/fu...`). Porem, os logs confirmam o problema:

```
Body keys: phone, message, name
Unresolved template variables detected { phone: "{{phone}}", message: "{{message}}", senderName: "{{name}}" }
```

O ChatCenter esta enviando `{{phone}}`, `{{message}}`, `{{name}}` como texto literal — as variaveis nao estao sendo resolvidas. Isso significa que o ChatCenter **nao suporta interpolacao de variaveis no body do webhook** ou a sintaxe esta incorreta.

## Diagnostico

O webhook do ChatCenter provavelmente envia o payload automatico com os dados da mensagem em campos fixos (nao configuráveis). A funcao atual rejeita tudo por causa do check de `{{`.

## Plano de implementacao

### Modificar `supabase/functions/dra-lia-whatsapp/index.ts`

1. **Remover rejeicao de template variables** — substituir por warning no log e continuar processamento
2. **Adicionar modo debug** — query param `?debug=true` que loga o body completo e retorna 200 sem processar, para descobrir os campos reais do ChatCenter
3. **Adicionar protecao anti-loop**:
   - Ignorar `fromMe === true` / `isFromMe === true`
   - Ignorar `isGroup === true`
   - Deduplicacao: checar ultima mensagem outbound no `whatsapp_inbox` para mesmo telefone nos ultimos 5 segundos
4. **Expandir mapeamento de campos** para cobrir payloads do ChatCenter:
   - `body.contact?.phone`, `body.data?.phone`, `body.chatId`
   - `body.data?.message`, `body.data?.text`, `body.lastMessage`
   - `body.contact?.name`, `body.data?.name`, `body.pushName`

### Fluxo de teste

1. Deploy da funcao com modo debug
2. Voce envia mensagem de teste pelo WhatsApp → ChatCenter dispara webhook
3. Verificamos os logs para ver o payload real (campos e estrutura)
4. Ajustamos o mapeamento final conforme necessario

