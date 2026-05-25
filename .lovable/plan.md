## Diagnóstico

ManyChat envia POST para `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/manychat-lia-bridge` com:

```json
{ "subscriber_id": "888640279", "name": "Danilo", "message": "Oi" }
```

**A função `manychat-lia-bridge` não existe** (confirmado via `ls supabase/functions/`). O `200 OK` com `{"reply":"","content":{"messages":[]}}` é apenas o fallback do gateway Supabase respondendo vazio — nada é processado, nada é gravado, LIA nunca é chamada.

Os 11 registros `mc_*` em `agent_interactions` com `lead_id=null` e resposta "informe seu e-mail" são de tentativas antigas que iam direto pra `dra-lia` sem `source` nem `manychat_subscriber_id` — então a lógica Instagram já implementada no `dra-lia` nunca disparou.

## Plano

### 1. Criar `supabase/functions/manychat-lia-bridge/index.ts`

Função pública (sem JWT) que:

a. **Valida payload**: `subscriber_id` (obrigatório), `name` e `message` (opcionais).

b. **Aplica 3 short-circuits ANTES do LLM** (retorna resposta vazia no formato ManyChat para o fluxo não enviar nada):
   - Mensagem `< 3` chars recebida dentro de 20s da última inbound do mesmo `subscriber_id` (consulta `agent_interactions` por `session_id = mc_{subscriber_id}`) → ignora (anti-loop "oi/ok").
   - Mensagem só com emoji / URL / pontuação (regex) → ignora.
   - Saudação curta (`/^(oi|olá|ola|hi|hello|bom dia|boa tarde|boa noite)\b/i`) **e** lead já existe com `manychat_subscriber_id` correspondente → responde saudação curta personalizada (`Oi, {nome}! 👋 Como posso te ajudar?`) sem chamar LLM.

c. **Chama `dra-lia`** via `fetch` interno (service role) com:
   ```json
   {
     "message": "<texto>",
     "session_id": "mc_<subscriber_id>",
     "source": "manychat_instagram",
     "manychat_subscriber_id": "<subscriber_id>",
     "manychat_name": "<name>",
     "lang": "pt-BR"
   }
   ```

d. **Traduz resposta do `dra-lia`** para formato ManyChat External Request v2:
   ```json
   {
     "version": "v2",
     "content": {
       "messages": [{ "type": "text", "text": "<resposta>" }],
       "actions": [],
       "quick_replies": []
     }
   }
   ```
   Se `dra-lia` retornar `quick_replies`, mapeia para `content.quick_replies`. Em erro, retorna mensagens vazias (não trava o fluxo do ManyChat).

e. **CORS + `verify_jwt = false`** em `supabase/config.toml`.

f. **Logging** em `system_health_logs` (`source = "manychat_bridge"`) para cada short-circuit / erro.

### 2. Atualizar `supabase/config.toml`

Adicionar:
```toml
[functions.manychat-lia-bridge]
verify_jwt = false
```

### 3. Atualizar memória

`mem/dra-lia/progressive-qualification-flow.md`: documentar o bridge como ponto de entrada único do canal Instagram/ManyChat (hoje a memória só fala do lado `dra-lia`).

### 4. Deploy + validação

- Deploy `manychat-lia-bridge`.
- `curl` com `{"subscriber_id":"888640279","name":"Danilo","message":"Oi"}` e validar:
  1. resposta no formato v2;
  2. registro em `lia_attendances` com `manychat_subscriber_id = "888640279"`;
  3. `agent_interactions` com `lead_id` preenchido;
  4. segunda mensagem (`"Quero saber sobre resinas"`) é reconhecida como returning lead.

### Arquivos afetados

- **Novo:** `supabase/functions/manychat-lia-bridge/index.ts`
- **Editado:** `supabase/config.toml`
- **Editado:** `mem/dra-lia/progressive-qualification-flow.md`

### Fora de escopo

- Mexer em `dra-lia/index.ts` (a lógica Instagram já está pronta lá).
- Alterar a configuração no ManyChat (URL e payload atuais já bastam).