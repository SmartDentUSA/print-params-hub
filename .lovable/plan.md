## Diagnóstico

**Qual provider foi usado?** Evolution GO (porta 8081), não Evolution API.

Em `wa-dispatcher/index.ts:112`:
```ts
const useEvoGo = !!evoGoToken
```
Como o membro `smartdent_marketing` tem `evo_go_instance_token` preenchido, o dispatcher roteia **todo o envio de grupo por EvoGo**, ignorando o `messaging_provider` do UI.

**Causa do "Tipo 'msg' nao suportado":**

- `team_members.evo_go_base_url` está gravado como `http://82.25.75.61:8081/` (com barra final).
- `evoGoPost` faz `${baseUrl}${path}` → resulta em `http://82.25.75.61:8081//send/text`.
- O runtime EvoGo devolve `404 page not found` para o path com barra dupla.
- `evoGoPost` mapeia qualquer 404 para `ENDPOINT_NOT_FOUND`, e o dispatcher traduz para `Tipo 'msg' nao suportado`. Enganoso: o endpoint existe, só a URL estava mal formada.

Confirmação via probe direto no runtime:
- `POST /send/text` (uma barra) com token correto → **200 OK, mensagem entregue** no grupo `120363425605712771@g.us`.
- `POST //send/text` (duas barras) → **404 page not found**.

## Correção

`supabase/functions/wa-dispatcher/index.ts`:

1. Em `evoGoPost` (linha 25), normalizar a base removendo barra final antes de concatenar o path:
   ```ts
   const url = `${baseUrl.replace(/\/$/, '')}${path}`
   ```
   Corrige todos os envios EvoGo (text/media/button/list/carousel) de uma vez.

2. Trocar a mensagem enganosa `Tipo '${item.node_type}' nao suportado` (linha 156) por algo diagnóstico quando o path retorna 404:
   ```ts
   throw new Error(`EvoGo 404 em ${path} — verifique evo_go_base_url e token`)
   ```
   Assim, se voltar a ocorrer 404, o erro aponta para credencial/URL em vez de sugerir que o tipo `msg` não existe.

Nenhuma mudança de frontend nem de schema. `evo_go_base_url` do membro pode continuar com barra final — o dispatcher passa a lidar com isso.

## Validação

- Reprocessar a mensagem pendente do campaign `198aca33-f0bc-4ab0-8433-816a02b2b448` (grupo `120363425605712771@g.us`): deve sair como `sent` com `evo_message_id` preenchido.
- Nenhuma nova ocorrência de `Tipo 'msg' nao suportado` em `wa_message_queue.error_message` após o deploy.

## Arquivos

- `supabase/functions/wa-dispatcher/index.ts` — strip de barra final em `evoGoPost` + mensagem de erro mais clara.
