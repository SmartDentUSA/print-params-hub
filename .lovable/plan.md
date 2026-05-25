## Diagnóstico

O sintoma visível ("só fica mensagem fallback") tem causa direta no código:

1. Hoje a bridge responde **imediatamente** com `EMPTY_REPLY` (`messages: []`) e processa `dra-lia` em background, mandando a resposta depois via **ManyChat Send API**.
2. Quando o ManyChat recebe `content.messages = []`, ele dispara o **fallback** do bloco (mensagem padrão).
3. A entrega "real" depois via Send API está falhando com `401 "Wrong token"` (confirmado nos `system_health_logs` e em teste curl direto contra `api.manychat.com`). Por isso o lead **nunca** vê a resposta da Dra. LIA — só o fallback.

Conclusão: o caminho `async + Send API` depende de um token que a API rejeita. A versão que "estava funcionando" era a **síncrona** — bridge devolvia o texto da Dra. LIA direto no JSON de resposta do External Request, e o ManyChat exibia. Sem Send API, sem token, sem fallback.

## Mudança

Reverter `supabase/functions/manychat-lia-bridge/index.ts` para o modelo **síncrono com timeout defensivo**:

1. Remover `EdgeRuntime.waitUntil(processAsync(...))` e a função `sendToManychat`.
2. No caminho LLM, chamar `dra-lia` e aguardar a resposta SSE com `AbortController` de **8s** (margem segura abaixo dos ~10s do ManyChat).
3. Se a resposta chegar a tempo → retornar `textReply(reply)` com os chunks em `messages: [{type:"text", text:chunk1}, {type:"text", text:chunk2}, ...]` (ManyChat aceita múltiplas mensagens no mesmo `content`).
4. Se estourar timeout ou erro → retornar `EMPTY_REPLY` (fallback do ManyChat assume) e logar em `system_health_logs` como `dra_lia_timeout` para monitorar.
5. Manter intactos os short-circuits existentes (greeting conhecido, emoji, URL, loop guard) — eles já eram síncronos.

## O que NÃO muda

- Endpoint público (`/manychat-lia-bridge`) e contrato de entrada (`subscriber_id`, `message`, `name`).
- `dra-lia` e toda a lógica de qualificação progressiva.
- Sessão `mc_<subscriber_id>` e short-circuits.

## Detalhes técnicos

- `consumeSSE` recebe um `signal` do AbortController; ao abortar, captura o que já foi acumulado (best-effort — descarta se < 20 chars).
- `chunkText` continua igual; resultado vira array de `{type:"text", text}` em `content.messages`.
- Logs novos: `sync_dispatch`, `sync_reply_ok` (com `reply_len`, `chunks`, `elapsed_ms`), `dra_lia_timeout`, `dra_lia_error_sync`.
- `MANYCHAT_API_KEY` deixa de ser usado pela bridge (pode ficar como secret órfão; não removo agora).

## Validação

1. Deploy da função.
2. Mandar DM do `888640279` para o Instagram da SmartDent.
3. Conferir em `system_health_logs`:
   - `sync_dispatch` → `sync_reply_ok` com `elapsed_ms < 8000`.
   - Sem `manychat_send_failed`.
4. Mensagem da Dra. LIA aparece no Instagram **sem** o fallback.

Se `dra_lia_timeout` aparecer com frequência, próximo passo é encurtar o prompt/SSE da `dra-lia`, não voltar para Send API.
