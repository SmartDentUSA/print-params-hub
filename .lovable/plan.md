## Diagnóstico

Verifiquei `wa_send_log` e há **dezenas de mensagens com `success=true` enviadas 2-3 vezes em segundos** (ex.: queue_id `3d2db857…` enviado 3x em 8s, todos via instância "Danilo Henrique" em 22/06 22:15-22:19). Cada execução gerou um `evo_message_id` diferente — ou seja, o WhatsApp recebeu 3 mensagens reais por linha da fila.

### Causa raiz

`supabase/functions/wa-dispatcher/index.ts` faz:

1. `SELECT … FROM wa_message_queue WHERE status='pending' LIMIT 5`
2. Loop nos resultados; só dentro do loop faz `UPDATE … SET status='sending' WHERE id=…`

Como o cron dispara o `wa-dispatcher` em paralelo (ou se sobrepõe quando um run demora pelos `sleep` de 10-35s entre envios), **duas ou três invocações simultâneas selecionam exatamente o mesmo conjunto de linhas `pending`** antes que qualquer uma consiga marcar `sending`. Resultado: a mesma `queue_id` é enviada N vezes.

A "deduplicação" da linha 88 (`findMessageStatus`) só funciona quando `evo_message_id` já está gravado — não cobre o primeiro envio de cada execução paralela.

`wa-broadcast-dispatch` tem o mesmo padrão (marca `dispatching` só depois do `SELECT` de scheduled), mas como roda lead-a-lead com jitter de 1-3s o impacto observado foi nos grupos.

## Plano (3 mudanças cirúrgicas)

### 1. Migration: RPC atômica `claim_pending_wa_messages`

```sql
CREATE OR REPLACE FUNCTION public.claim_pending_wa_messages(p_limit int DEFAULT 5)
RETURNS SETOF public.wa_message_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.wa_message_queue q
     SET status = 'sending', updated_at = now()
   WHERE q.id IN (
     SELECT id FROM public.wa_message_queue
      WHERE status = 'pending'
        AND scheduled_at <= now()
      ORDER BY scheduled_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_wa_messages(int) TO service_role;
```

`FOR UPDATE SKIP LOCKED` garante que dois runs concorrentes nunca peguem a mesma linha; o `UPDATE … RETURNING` devolve as linhas já marcadas como `sending` em uma única transação.

### 2. `wa-dispatcher/index.ts`

- Substituir o bloco `SELECT … wa_campaigns!inner …` por `supabase.rpc('claim_pending_wa_messages', { p_limit: MAX_PER_RUN })`.
- Como a RPC retorna só `wa_message_queue`, fazer um segundo `SELECT id, delay_seconds, daily_limit, status FROM wa_campaigns WHERE id IN (…)` e montar um `Map<campaignId, camp>` para usar onde hoje se lê `item.wa_campaigns`.
- Filtrar localmente as linhas cuja `campaign.status !== 'active'` (devolvendo-as ao status `pending` ou marcando `skipped`) para preservar o filtro `wa_campaigns.status='active'` que existia no SELECT.
- Remover o `await supabase.from('wa_message_queue').update({ status: 'sending' })` da linha 85 (já feito pela RPC).

### 3. Nada na fila histórica — só prevenção

Não alterar `wa_send_log` nem reembolsar envios passados. Os logs continuam como auditoria do incidente.

## Fora de escopo

- `wa-broadcast-dispatch`: mesmo padrão, mas baixa concorrência observada. Anotar como follow-up se reincidir.
- Alterar o cron schedule do `wa-dispatcher`.
- Migration de FKs/cascades em outras tabelas.

## Verificação após deploy

```sql
SELECT queue_id, COUNT(*) FROM wa_send_log
 WHERE success AND sent_at > now() - interval '1 hour'
 GROUP BY 1 HAVING COUNT(*) > 1;
```

Deve retornar zero linhas em campanhas executadas após a mudança.
