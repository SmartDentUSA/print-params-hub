## Diagnóstico (dados reais das últimas 6h)

Olhando `agent_interactions` filtrado por `session_id LIKE 'wa_%'`:

### Bug 1 — `@lid` não resolvido vira session_id "fantasma"
Sessões com 14-15 dígitos (não são telefones BR válidos):
- `wa_85427386060951`, `wa_217643424423953`, `wa_270900884713608`, `wa_98908885786860`, `wa_252982331457641`, `wa_146613104304265`...

Esses são **WhatsApp LIDs** (IDs internos). O código tenta resolver `@lid → senderPn`, mas quando o Evolution não envia `senderPn`/`participant`, cai no fallback e usa o próprio LID como telefone. Consequência:

- O mesmo contato gera **múltiplos `session_id`** (um por LID/dispositivo + um com telefone real).
- Cada nova sessão tem histórico vazio → LIA **reinicia a qualificação a cada turno** ("informe seu e-mail", "qual sua área?", etc.).
- Exemplo: `wa_98908885786860` (82 turnos) e `wa_270900884713608` (32 turnos) são claramente a mesma conversa (Henrique / Elegoo Mars 5 Ultra) dividida.

### Bug 2 — LIA conversa consigo mesma (eco)
Em `wa_98908885786860` aparecem como `user_message`:
- `"Encontrei a Elegoo Mars 5 Ultra! Qual resina você vai usar?"`
- `"Me diga o nome da resina e verifico os parâmetros para você 😊"`
- `"Mas não se preocupe! Nossa equipe de especialistas técnicos pode resolver isso agora mesmo para você"`

São respostas **da própria LIA** voltando como inbound. O guard `shouldIgnore` só checa `fromMe`/`isGroup`. Quando outro canal (SDR humano, automação Sellflux) envia mensagem pelo mesmo número, o webhook trata como inbound do lead. Resultado: LIA responde à própria fala e o usuário vê o bot "avançando sozinho" (`"Está avançando sem eu ter respondido"` — reclamação literal em `wa_36099401461830`).

### Bug 3 — Pré-seed da sessão não bloqueia o `needs_email_first`
Mesmo após upsert de `agent_sessions` com `lead_email`, o interceptor `lead_collection:needs_email_first` em `dra-lia` segue disparando ("Para que eu possa te reconhecer, informe seu e-mail" — visto em `wa_217643424423953` e `wa_252982331457641`). O interceptor lê `lia_attendances` por outro critério (não a sessão), e o pré-seed só ocorre quando `isRealLead = true` — mas a maioria dos casos chega via LID/placeholder e cai no else.

### Bug 4 — Histórico fica preso a `session_id` instável
`history` é buscado por `eq("session_id", sessionId)`. Como o `sessionId` muda quando o LID muda, o histórico é sempre vazio para esses casos, mesmo quando o `lead_id` é o mesmo (e tem 50+ turnos no outro session_id).

---

## Plano

### 1. Resolver `@lid` de forma robusta antes de derivar `sessionId`
Em `extractFields`:
- Expandir busca de telefone real: `body.data.key.senderPn`, `body.data.key.participantPn`, `body.contextInfo.participant`, `body.message.contextInfo.participant`, `body.pushName_phone`, `body.contact.wa_id`.
- Se ainda assim não resolver, **NÃO** usar o LID como telefone. Em vez disso, consultar `lia_attendances` por `lid_id` (novo campo opcional em `extracted_entities` ou tabela de mapping `wa_lid_phone_map`) ou ignorar o webhook (`status: 200, reason: "unresolved_lid"`) e logar para investigação.
- Persistir o mapeamento `lid → phone` em `wa_lid_phone_map` (cria tabela simples) sempre que conseguir resolver, para os próximos webhooks usarem direto.

### 2. Session ID estável baseado no lead, não no LID
- Se conseguir resolver o telefone real → `sessionId = wa_<phoneDigits>` (igual hoje).
- Se houver `leadId` (match por telefone OU por LID mapeado) → `sessionId = lead_<leadId>` como override, garantindo que histórico do mesmo lead sempre seja recuperado independentemente do canal.
- Migração suave: ao processar um webhook, se o telefone real for resolvido e existir `agent_interactions` antigo com `session_id = wa_<lid>` para esse mesmo lead, fazer `UPDATE agent_interactions SET session_id = wa_<phone> WHERE session_id = wa_<lid>` (uma vez, idempotente).

### 3. Anti-eco robusto contra mensagens enviadas por outros canais
Em `shouldIgnore` + dedup:
- Antes de processar, comparar `messageText` (normalizado: lowercase, trim, sem emojis/pontuação) com as **últimas 5 respostas outbound** da LIA para esse telefone (já há `whatsapp_inbox` com `direction='outbound'`).
- Se match exato OU `levenshtein < 5%`, retornar `{ignored: true, reason: "echo_of_own_message"}`.
- Adicional: se a mensagem inbound chegar < 3s após uma outbound da LIA E começar com "Olá!", "Entendi", "Perfeito" ou outras frases típicas de bot, ignorar como eco.

### 4. Bloquear `needs_email_first` quando sessão já tem identidade
No `dra-lia` (interceptor de coleta de email):
- Antes de disparar `needs_email_first`, checar `agent_sessions.extracted_entities.lead_email`. Se presente e válido, pular o interceptor.
- Atualmente já há lógica similar, mas só roda quando `leadState.leadId` está presente. Adicionar fallback via session.

### 5. Pré-seed também para leads conhecidos por telefone (não só "real lead")
Hoje só faz pré-seed completo quando `isRealLead = leadId && leadEmail && !@whatsapp.lead`. Mudar para:
- Se `leadId` existe (qualquer match), pré-seedar `lead_id`, `lead_name`, `lead_email` (mesmo placeholder) em `agent_sessions`, marcando `extracted_entities.identity_known = true`.
- O interceptor de qualificação no `dra-lia` então respeita essa flag e não pergunta de novo.

### 6. Telemetria mínima
- Log estruturado por sessão: `{event: "wa_inbound", phone_resolved: bool, lid_fallback: bool, session_reused: bool, history_turns: N}`.
- Query de auditoria sugerida (sem implementar agora): contar sessions duplicadas por lead nas últimas 24h.

---

## Arquivos a alterar

- `supabase/functions/dra-lia-whatsapp/index.ts` — itens 1, 2, 3, 5.
- `supabase/functions/dra-lia/index.ts` — item 4 (apenas o interceptor `needs_email_first`).
- Nova migration: `wa_lid_phone_map` (`lid_id text PK`, `phone_digits text`, `lead_id uuid null`, `created_at`, `last_seen_at`).
- Backfill SQL one-shot: consolidar `agent_interactions` órfãs com `session_id = wa_<lid>` para `wa_<phone>` onde o lead já está resolvido.

## Fora deste plano
- Mudar `dra-lia` site (intocado).
- Trocar provedor de WhatsApp.
- Reformar a UI do Inbox.

## Validação
1. Mesmo lead enviando por 2 dispositivos (LID diferente) → 1 só `session_id`, histórico contínuo.
2. SDR humano respondendo manualmente pelo mesmo número → próxima inbound do lead NÃO trata a fala do SDR como eco do lead.
3. Lead conhecido (com email) envia "oi" → LIA cumprimenta pelo nome, **não** pergunta email.
4. `wa_98908885786860` + `wa_270900884713608` colapsam em um único `session_id` após backfill.