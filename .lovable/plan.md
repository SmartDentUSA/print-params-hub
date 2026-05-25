## Estado real verificado

**O que NÃO existe (apesar da narrativa):**
- ❌ Não há função `manychat-lia-bridge` no repositório. Funções LIA existentes: `dra-lia`, `dra-lia-whatsapp`, `dra-lia-export`, `automacoes-lia`, `backfill-lia-leads`, `smart-ops-lia-assign`.
- ❌ Não há os "3 atalhos antes do LLM" (curto-em-20s, só-emoji/URL, saudação-de-lead-identificado) implementados em lugar nenhum no fluxo ManyChat.
- ❌ Não há "resolução de identidade em 4 camadas". Em `dra-lia/index.ts` **nenhuma busca por `manychat_subscriber_id`** existe (`rg` retorna zero matches).

**O que existe:**
- ✅ Coluna `manychat_subscriber_id` em `lia_attendances` (4 leads populados, 0 com `instagram`).
- ✅ Guard `isInstagramChannel` (linha 1604) — mas só troca a saudação de returning lead por uma versão curta; **não resolve identidade**.
- ✅ `agent_interactions` confirma o sintoma: 11 sessões `mc_*`, **todas** `lead_id=null`, **todas** respondem "informe seu e-mail".

**Causa raiz:** o ManyChat envia `session_id = mc_{subscriber_id}` + `name`, mas o dra-lia só sabe identificar lead por **email**. Como Instagram DM não traz email, todo usuário cai em `ASK_EMAIL` para sempre. O `manychat_subscriber_id` salvo na tabela nunca é consultado.

---

## Plano de correção

### 1. Resolver identidade por `manychat_subscriber_id` no dra-lia
No bloco de lead lookup (antes de cair em `ASK_NAME`/`ASK_EMAIL`), quando `session_id` começa com `mc_`:
- Extrair `subscriberId = session_id.replace(/^mc_/, "")`.
- `SELECT ... FROM lia_attendances WHERE manychat_subscriber_id = $1 AND merged_into IS NULL LIMIT 1`.
- Se achar → tratar como returning lead identificado (popula `currentLeadId`, `leadState.email`, segue para greeting curto que já existe atrás de `isInstagramChannel`).
- Se não achar → seguir fluxo de novo lead, **mas** persistir `manychat_subscriber_id` + `instagram` (nome do ManyChat) no momento em que o lead for criado, para que a próxima mensagem já reconheça.

### 2. Aceitar `subscriber_id` e `name` no payload do dra-lia
Adicionar ao destructuring de `req.json()`:
```ts
const { ..., source: requestSource, manychat_subscriber_id, manychat_name } = await req.json();
```
Quando `requestSource === "manychat_instagram"` e `manychat_subscriber_id` vier no body, usar como chave de lookup mesmo que `session_id` não tenha prefixo `mc_`.

### 3. Ao criar/atualizar lead vindo do Instagram
No `upsertLead`/equivalente, quando `isInstagramChannel` e há `manychat_subscriber_id`:
- Gravar `manychat_subscriber_id`, `manychat_collected_at = now()`, `instagram = manychat_name` (se vazio), `origem_primeiro_contato = 'instagram_manychat'` (apenas no insert — origem é frozen).

### 4. Aliviar o gate de email para canal Instagram
Hoje, sem email confirmado a LIA bloqueia tudo. Para `isInstagramChannel`:
- Se o lead foi reconhecido por `manychat_subscriber_id` → não pedir email; seguir conversa normal (RAG/SDR).
- Se é primeiro contato → pedir **nome** (uma vez, usando `manychat_name` como sugestão) e seguir; pedir email só na qualificação progressiva quando houver intent comercial (preço/proposta), conforme a regra `progressive-qualification-flow`.

### 5. Atualizar memória
Atualizar `mem://dra-lia/progressive-qualification-flow` documentando que no canal Instagram a chave primária é `manychat_subscriber_id` (não email) e email vira opcional até intent comercial.

### Arquivos afetados
- `supabase/functions/dra-lia/index.ts` (resolução de identidade + persistência ManyChat + gate de email condicional ao canal)
- `mem/dra-lia/progressive-qualification-flow.md` (atualização da regra)

### Validação após deploy
- Curl em `dra-lia` com `{ source:"manychat_instagram", session_id:"mc_888640279", manychat_subscriber_id:"888640279", manychat_name:"Teste", message:"Olá" }` 2x: primeira cria lead, segunda já cai em saudação curta com `lead_id` populado.
- `SELECT lead_id FROM agent_interactions WHERE session_id LIKE 'mc_%' ORDER BY created_at DESC LIMIT 5;` — não deve mais haver `null` para sessões repetidas.

### Fora do escopo
- Criar a função `manychat-lia-bridge` com os "3 atalhos antes do LLM" (curto-em-20s, só-emoji, saudação-direta). Posso fazer numa segunda etapa se quiser — não é necessário para destravar a identificação.
