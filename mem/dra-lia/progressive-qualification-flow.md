---
name: Progressive Qualification Flow
description: Dra. LIA always asks Name → Email → Area → Specialty in order, skipping fields already present in lia_attendances history
type: feature
---
**Regra invariável** (em `supabase/functions/dra-lia/index.ts`):

1. **Verificar se o lead existe** por email/telefone em `lia_attendances` (filtro `merged_into IS NULL`).
2. Se **não existe** → perguntar **nome** (`ASK_NAME`), depois **email** (`ASK_EMAIL`), faz upsert do lead.
3. Após ter nome+email → checar `area_atuacao` no histórico. Se **vazio**, perguntar área (`ASK_AREA` + `show_area_grid`).
4. Após área → checar `especialidade`. Se **vazia**, perguntar especialidade (`ASK_SPECIALTY` + `show_specialty_grid`).
5. **NUNCA repetir** pergunta cujo valor já está em `lia_attendances` (nome, email, telefone_normalized, area_atuacao, especialidade). Returning leads pulam direto para o que falta.
6. Só depois desse gate o RAG / DeepSeek é acionado. Sem qualificação mínima → sem resposta de conteúdo.

Flags de sessão em `agent_sessions.extracted_entities`: `awaiting_phone`, `awaiting_area`, `awaiting_specialty`, `lead_area`.

## Exceção — Canal ManyChat / Instagram (`source: "manychat_instagram"`)

Instagram DM não fornece email. Para esse canal, a chave primária de identidade é `manychat_subscriber_id` (não email):

1. dra-lia extrai `subscriberId` de `body.manychat_subscriber_id` ou do prefixo `mc_` em `session_id`.
2. Lookup em `lia_attendances` por `manychat_subscriber_id` (filtro `merged_into IS NULL`). Se achar → trata como returning lead (passa pelo fluxo existente de saudação curta).
3. Se NÃO achar → cria registro mínimo (`nome` vinda do ManyChat, `email = mc_{subscriberId}@manychat.internal` apenas como chave interna, `manychat_subscriber_id`, `origem_primeiro_contato = 'instagram_manychat'`, `crm_creation_blocked = 'instagram_no_real_email'`) e pré-popula `agent_sessions` para que a próxima mensagem caia em `from_session`.
4. O email sintético `@manychat.internal` NUNCA é enviado para PipeRun/CRM (bloqueado por `crm_creation_blocked`). Email real só é coletado quando o lead manifestar intent comercial.