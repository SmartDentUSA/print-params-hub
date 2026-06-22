## Diagnóstico

Todas as duplicatas em grupos aconteceram em **22/06 entre 22:15 e 22:21 UTC**, na instância "Danilo Henrique":

- 13 `queue_id`s diferentes foram enviados 2-3x cada (cada envio com `evo_message_id` distinto = Evolution recebeu cada chamada).
- A migração `claim_pending_wa_messages` + patch no `wa-dispatcher` foi aplicada às **22:21:35 UTC**.
- Após esse horário, **não há novos envios de grupo no `wa_send_log`** (último: 22:21:30). Ou seja: o pico de duplicação foi causado exatamente pela race condition já corrigida no `wa-dispatcher` (múltiplos crons rodando em paralelo pegaram as mesmas linhas `status='pending'` antes do `UPDATE … sending` line-by-line).

### Causa raiz (já corrigida)
`wa-dispatcher` fazia `SELECT ... WHERE status='pending'` e só marcava `sending` dentro do loop, item por item. Quando 2-3 invocações do cron rodavam em paralelo (cron a cada minuto + processamento lento da Evolution), todas pegavam o mesmo lote.

A RPC `claim_pending_wa_messages` agora reserva atomicamente via `FOR UPDATE SKIP LOCKED + UPDATE … RETURNING`, eliminando a corrida.

## O que falta endurecer

`wa-broadcast-dispatch` tem **a mesma race no modo cron** (linha 28): seleciona `social_broadcasts WHERE status='scheduled'` e só marca `dispatching` depois, dentro de `dispatch()`. Se dois crons rodarem ao mesmo tempo, ambos disparam o mesmo broadcast. Hoje não causou problema porque é pouco usado, mas é a próxima bomba.

### Mudanças

1. **Migração: RPC `claim_scheduled_broadcasts(p_limit int)`**
   - `UPDATE social_broadcasts SET status='dispatching', updated_at=now() WHERE id IN (SELECT id FROM social_broadcasts WHERE status='scheduled' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT p_limit FOR UPDATE SKIP LOCKED) RETURNING id`.
   - `GRANT EXECUTE ... TO service_role`.

2. **`supabase/functions/wa-broadcast-dispatch/index.ts`**
   - Substituir o `SELECT ... WHERE status='scheduled'` no modo cron por `supabase.rpc('claim_scheduled_broadcasts', { p_limit: 5 })`.
   - Remover o `update({ status: 'dispatching' })` redundante no início de `dispatch()` (já feito pela RPC; manter para chamadas diretas por `broadcast_id` via `UPDATE ... WHERE id=? AND status<>'dispatching'`).

3. **Query de verificação contínua** (sem mudança de código, só documentar):
   ```sql
   SELECT queue_id, group_jid, COUNT(*) FROM wa_send_log
   WHERE success AND sent_at > now() - interval '1 hour' AND group_jid IS NOT NULL
   GROUP BY 1,2 HAVING COUNT(*) > 1;
   ```

## O que NÃO fazer

- Não mexer em `wa-dispatcher` (já corrigido na sessão anterior).
- Não reprocessar `wa_send_log` antigo — só prevenção daqui pra frente.
- Não tentar deduplicar do lado da Evolution — cada chamada tem `evo_message_id` próprio, não dá pra distinguir lá.
