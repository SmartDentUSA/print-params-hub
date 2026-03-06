

# Fix: LIA WhatsApp Pede Email Infinitamente

## Causa Raiz Real (3 bugs encadeados)

O problema NAO e so o @lid. Ha 3 bugs que se reforçam:

### Bug 1: History query usa `lead_id`, mas dra-lia salva com `session_id`

Em `dra-lia-whatsapp` linha 331-336, o historico e carregado assim:
```
.from("agent_interactions")
.eq("lead_id", leadId)
```

Mas quando dra-lia pede o email (linhas 3247-3255), ela salva a interacao com `session_id` e **sem lead_id**. Resultado: na proxima mensagem, a query por `lead_id` retorna vazio. History = []. Loop infinito.

### Bug 2: agent_sessions nunca e pre-populado pelo WhatsApp

A funcao `detectLeadCollectionState` (linha 890) verifica:
```
if (sessionEntities?.lead_id && lead_name && lead_email) → skip collection
```

Mas `dra-lia-whatsapp` nunca cria a `agent_sessions` com os dados do lead. Entao `sessionEntities = null` → `needs_email_first` toda vez.

### Bug 3: @lid sem telefone real = lead novo a cada vez

Quando WaLeads nao envia `senderPn`/`remoteJidAlt`, o LID e usado como telefone. Match por `telefone_normalized` falha. Cria lead novo. Mas mesmo com lead existente, Bugs 1 e 2 ja causariam o loop.

## Solucao (2 mudancas no `dra-lia-whatsapp`)

### Fix 1: Query history por `session_id` em vez de `lead_id`

Trocar:
```typescript
.eq("lead_id", leadId)
```
Por:
```typescript
.eq("session_id", `wa_${phoneDigits}`)
```

Isso garante que o historico inclui TODAS as interacoes da sessao WhatsApp, inclusive as que dra-lia salvou sem lead_id.

### Fix 2: Pre-seed `agent_sessions` antes de chamar dra-lia

Quando um lead e encontrado ou criado, fazer upsert em `agent_sessions` com os dados do lead ANTES de chamar dra-lia:

```typescript
await supabase.from("agent_sessions").upsert({
  session_id: sessionId,
  lead_id: leadId,
  extracted_entities: {
    lead_id: leadId,
    lead_name: leadNome || `WhatsApp ${phoneDigits.slice(-4)}`,
    lead_email: leadEmail,
  },
  last_activity_at: new Date().toISOString(),
}, { onConflict: "session_id" });
```

Com isso, `detectLeadCollectionState` vai encontrar `sessionEntities.lead_id + lead_name + lead_email` e retornar `from_session` — pulando toda a coleta de email/nome.

## Arquivo Alterado

- `supabase/functions/dra-lia-whatsapp/index.ts` (~10 linhas modificadas)

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| History vazio (query por lead_id) | History completo (query por session_id) |
| Session vazia → pede email | Session pre-populada → pula direto |
| Loop infinito "informe seu email" | LIA conversa normalmente |

