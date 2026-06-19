## Problema

Quando o usuário pede "criar automação de menção em Story", o Copilot diz:
> "você precisará também configurar o gatilho no Zernio com a mesma configuração."

Isso está errado. A API Zernio **não tem endpoint de automação para menção em Story** — menções chegam direto via webhook (o `zernio-webhook` já trata `event.includes('mention') → trigger_type:'mention'` e dispara o flow). Nenhuma configuração extra é necessária. Apenas `comment_keyword_dm` precisa do POST `/v1/comment-automations` (que já é feito automaticamente pela tool).

## Mudanças

### 1. `supabase/functions/smart-ops-copilot/index.ts` — `executeCreateSocialFlow` (~linha 2756)

Adicionar bloco específico para `mention_reply` logo após o bloco Zernio do `comment_keyword_dm`, antes do `return result;`:

```ts
// Menções em Story: webhook Zernio já entrega evento 'mention' nativamente.
// Não existe endpoint de automação no Zernio para isso — o webhook dispara direto.
if (template === "mention_reply") {
  result.zernio_status = "ℹ️ Menções em Story são detectadas automaticamente pelo webhook Zernio. Nenhuma configuração extra necessária.";
}
```

### 2. `SYSTEM_PROMPT` — substituir a seção `### REGRA — COMMENT_KEYWORD_DM` (~linhas 2993-2994)

De:
```
### REGRA — COMMENT_KEYWORD_DM
Flows comment_keyword_dm dependem da automação nativa do Zernio. Ao criar, avise: "Este flow funciona via automação Zernio. Após ativar aqui, crie também a automação no Zernio com a mesma keyword."
```

Para:
```
### REGRA — COMMENT_KEYWORD_DM (criação automática no Zernio)
A tool `create_social_flow` JÁ chama o POST /v1/comment-automations do Zernio automaticamente para comment_keyword_dm. NÃO peça ao usuário para configurar manualmente no Zernio — apenas reporte o campo `zernio_status` retornado pela tool (✅ criado / ⚠️ falhou).

### REGRA — MENTION_REPLY / WELCOME_NEW_FOLLOWER / DRA_LIA_HANDOFF
Esses templates funcionam direto via webhook do Zernio (eventos `mention`, `new_follower`, `dm.received`). NÃO existe automação a configurar no Zernio para eles — basta criar e ativar o flow aqui. NUNCA diga ao usuário para "configurar o gatilho no Zernio" para estes templates.
```

### 3. Deploy

Deployar `smart-ops-copilot`.

### 4. Verificação

- "criar automação de menção em Story SmartDent" → pergunta só nome + mensagem DM, cria inativo, NÃO menciona configuração Zernio.
- "criar automação de comentário VITA → DM com link X" → cria e reporta `zernio_status` sem pedir ação manual.

## Fora de escopo

- Não tocar em `zernio-webhook`, `flow-executor`, `SocialFlowEditor`.
- Não adicionar template novo (ex: `story_reply` via API) — usuário confirmou que quer apenas `mention_reply`.
