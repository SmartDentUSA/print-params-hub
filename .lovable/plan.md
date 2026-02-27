

## Plano: Conectar Dra. L.I.A. ao WaLeads como Agente Autonomo

### Visao Geral

Criar uma edge function `dra-lia-whatsapp` que recebe webhooks do WaLeads, processa a mensagem usando toda a logica RAG da L.I.A. em modo nao-streaming, e retorna a resposta para o WaLeads enviar automaticamente ao lead.

### Arquitetura

```text
Lead envia msg WhatsApp
       ↓
  WaLeads recebe
       ↓
  POST → dra-lia-whatsapp (webhook)
       ↓
  1. Identifica lead por telefone (lia_attendances)
  2. Busca historico (agent_interactions)
  3. Chama dra-lia internamente (non-streaming)
  4. Salva interacao em agent_interactions
  5. Envia reply via WaLeads API
       ↓
  Lead recebe resposta no WhatsApp
```

### Implementacao

#### 1. Nova Edge Function: `supabase/functions/dra-lia-whatsapp/index.ts`

Recebe webhook do WaLeads com payload `{ phone, message, sender_name }`:
- Normaliza telefone e busca lead em `lia_attendances`
- Se nao encontrar, cria lead basico com telefone
- Busca ultimas 10 interacoes do lead em `agent_interactions` para montar historico
- Faz `fetch` interno para `dra-lia` com `action=chat`, passando message, history, lang, session_id
- Como `dra-lia` retorna SSE stream, consome o stream internamente e concatena a resposta completa
- Envia a resposta via WaLeads API (`/public/message/text?key={api_key}`) usando a chave do team_member configurado como "agente autonomo"
- Salva no `whatsapp_inbox` como registro de entrada + saida
- Retorna `{ success: true }` ao WaLeads

#### 2. Configuracao no `supabase/config.toml`

Adicionar:
```toml
[functions.dra-lia-whatsapp]
verify_jwt = false
```

#### 3. Coluna `agente_autonomo_member_id` na tabela de configuracao

Usar a tabela `team_members` para identificar qual membro tem a `waleads_api_key` que sera usada para enviar respostas. O webhook recebera um header ou query param com a key do WaLeads para identificar qual instancia esta recebendo.

### Detalhes Tecnicos

- A funcao consome o stream SSE da `dra-lia` linha por linha, extrai os deltas e concatena o texto final
- Remove markdown links `[texto](url)` na resposta para WhatsApp (nao renderiza markdown)
- Limita resposta a 4000 caracteres (limite do WhatsApp)
- Rate limit: se `dra-lia` retornar 429, responde ao WaLeads com mensagem padrao de espera
- Timeout: 30s para a chamada interna

### Arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/dra-lia-whatsapp/index.ts` | Criar — bridge WaLeads ↔ L.I.A. |
| 2 | `supabase/config.toml` | Adicionar entry para dra-lia-whatsapp |

### Configuracao no WaLeads (pos-deploy)

No painel do WaLeads, secao "Treinamento" → "Usar Website":
1. Configurar webhook de entrada apontando para: `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/dra-lia-whatsapp`
2. A L.I.A. respondera com todo o conhecimento RAG, persona e SPIN

