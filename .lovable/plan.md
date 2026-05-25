## Diagnóstico

O bloco "Solicitação externa" do ManyChat está em **modo External Request com Mapeamento de Resposta**: JSONPath `reply` → Custom Field `chatgpt_resposta`. O passo seguinte ("Enviar Mensagem") só renderiza `{{chatgpt_resposta}}`.

A função hoje retorna apenas `{ version, content: { messages: [...] } }` — não existe a chave `reply` no topo, então o ManyChat grava string vazia em `chatgpt_resposta` e o envio cai no texto-fallback do bloco. Isso explica os **88 envios sem nenhum e-mail/telefone capturado**.

## Mudanças

### 1. `supabase/functions/manychat-lia-bridge/index.ts`

Adicionar campos planos no topo do JSON de resposta para serem consumidos pelo Mapeamento de Resposta do ManyChat. Manter `content.messages` por compatibilidade com Dynamic Block.

Novo shape de toda resposta:

```json
{
  "version": "v2",
  "reply": "texto final que vai para chatgpt_resposta",
  "lead_name": "Fulano da Silva",
  "lead_email": "fulano@x.com",
  "lead_phone": "+5511999998888",
  "qualification_state": "ask_name | ask_email | ask_phone | completed",
  "content": { "messages": [{ "type": "text", "text": "<mesmo texto>" }] }
}
```

Detalhes:
- `reply` sempre preenchida (string única, com `\n` para quebras de linha) — é o que alimenta `chatgpt_resposta`.
- Quando `qualification_state = "completed"`, o `reply` já inclui as 4 rotas numeradas em texto (ex.: `1) 🌐 Site: https://www.smartdent.com.br …`) porque o bloco "Enviar Mensagem" do ManyChat não renderiza quick_replies dinâmicos vindos do External Request.
- `lead_name / lead_email / lead_phone` ficam disponíveis caso o usuário queira mapear depois nos System Fields (Email, Phone, Full Name) — opcional, não muda o fluxo atual dele.
- Não envia `messages: []` vazio em nenhum caminho de erro — sempre devolve uma `reply` textual.

Pontos a refatorar dentro do arquivo:
- `textReply(text)` → retornar `{ version:"v2", reply:text, content:{ messages:[{type:"text",text}] } }`.
- `replyWithRoutes(greeting)` → montar `reply` = `greeting + "\n\n" + lista de rotas em texto` (com URL do site), e popular `lead_*` no envelope.
- `EMPTY_REPLY` → garantir `reply:""` no shape para nunca quebrar o JSONPath.
- Em todos os `return jsonResponse(...)` (perguntar nome/email/telefone, retry inválido, perfil completo, erro), passar também `lead_name/email/phone` quando já conhecidos e `qualification_state` correspondente.
- Mensagem de erro do `catch` também usa o novo formato.

### 2. Sem mudanças de DB e sem novos secrets.

### 3. Sem mudanças no ManyChat
O mapeamento atual `reply → chatgpt_resposta` continua válido. Opcionalmente o usuário pode adicionar depois:
- `lead_email` → System Field Email
- `lead_phone` → System Field Phone
- `qualification_state` → Custom Field (para ramificar o fluxo)

## Validação

1. `curl` na função com `subscriber_id` novo → conferir que o JSON tem `reply` não-vazio.
2. Disparar pelo Instagram com subscriber novo → `system_health_logs` registra `manychat_ask_name`, depois `_email`, `_phone`, `manychat_profile_completed`.
3. No painel do ManyChat, abrir o contato de teste e confirmar que `chatgpt_resposta` agora vem preenchido a cada interação (o texto enviado deixa de ser o fallback).
4. Após qualificação, conferir que a mensagem enviada contém a lista de rotas numeradas + URL do site.

## Arquivo afetado
- `supabase/functions/manychat-lia-bridge/index.ts`
