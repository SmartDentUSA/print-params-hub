## Diagnóstico

Erro "Signal timed out." vem do `AbortSignal.timeout(45_000)` em `supabase/functions/_shared/evolution.ts` (`sendText` linha 192, `sendMedia` linha 210). O servidor Evolution self-hosted da instância `smartdent_marketing` está demorando >45s para responder ao envio no grupo, o que dispara o timeout.

O `wa-dispatcher` **já reconhece** esse padrão (`/timed out|aborted/`, linha 157) e tenta warmup + reenvio, mas se **ambas** tentativas estouram o mesmo teto de 45s, o item volta pra `pending` com o erro "Signal timed out." (é o quadro atual — status `pending`, agendado em 27min).

Riscos do timeout: o Evolution/Baileys pode **ter efetivamente entregado** a mensagem mesmo com a nossa conexão HTTP abortada — reenviar cegamente duplicaria conteúdo no grupo. Por isso o remédio não pode ser apenas "aumentar retry".

## Correção proposta

**1. `supabase/functions/_shared/evolution.ts`** — aumentar timeouts para envio em grupo, que costuma ter latência maior no Baileys:

- `sendText`: `45_000` → **90_000** (mantém proteção contra loop infinito, mas dá folga para grupos grandes).
- `sendMedia`: `60_000` → **120_000** (mídia em grupo é notavelmente mais lenta).

**2. `supabase/functions/wa-dispatcher/index.ts`** — quando `sendText`/`sendMedia` falhar com `timed out|aborted`, antes de retentar, checar via `findMessageStatus` **por conteúdo recente no grupo** para não duplicar. Como não temos `evo_message_id` ainda, uso a rota já existente `/chat/findMessages` filtrando por `remoteJid + fromMe=true + messageTimestamp > (now-2min)` e comparando o corpo textual. Se encontrado ⇒ marcar como `sent`, gravar `evo_message_id`, seguir para `advanceCampaign`. Se não ⇒ warmup + retry normal como hoje.

**3. Reconciliação da mensagem atual em `pending`** (SQL via `supabase--insert`, após deploy):

Não vou reabrir automaticamente. Deixo o dispatcher retomar no próximo ciclo (já está agendada em ~28min) — se ainda estiver `pending` amanhã e o Evolution voltar a responder, o novo código detecta duplicata via `findMessages` antes de reenviar.

## Escopo

- **Alterar:** `supabase/functions/_shared/evolution.ts` (2 constantes), `supabase/functions/wa-dispatcher/index.ts` (bloco `send()` + nova função helper `findRecentGroupMessageByText`).
- **Não tocar:** credenciais, `team_members`, `wa_groups`, EvoGo (path separado), UI, RPCs.

## Validação

1. Deploy automático do wa-dispatcher.
2. Aguardar retry agendado (~28min) ou pedir reprocesso manual pelo botão da UI.
3. Confirmar em `wa_send_log` que aparece `success=true, http_status=200` OU `success=true, note='dedup_by_content_after_timeout'`.
4. Ver `wa_message_queue` sem duplicatas para o mesmo `content_hash + group_jid` na janela de 2 min.
