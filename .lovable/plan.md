# Mensagens do Blast 24/06/2026 18:25 ficam "pending"

## Diagnóstico (confirmado em produção)

- Cron `wa-dispatcher-every-minute` está ativo e rodando 1x/min com `succeeded`.
- Invocação manual de `/wa-dispatcher` agora retorna `{"ok":true,"processed":0}` — não envia nada.
- A fila `wa_message_queue` tem **~83 linhas `pending`** pendurada de campanhas antigas com status `finished` / `error` / `paused` (Blast 29/05, Blast 10/06, "Régua única" com 49 rows, etc.). Essas linhas têm `scheduled_at` de 22/05–22/06.
- `claim_pending_wa_messages(p_limit=5)` ordena por `scheduled_at ASC` e devolve essas 5 linhas antigas primeiro.
- O dispatcher (linhas 64–73 de `wa-dispatcher/index.ts`) carrega `wa_campaigns.status` para cada uma, e como **nenhuma das 5 é `active`**, faz `UPDATE status='pending'` (devolve para a fila) e termina com `processed=0`.
- Resultado: as 2 mensagens do Blast 24/06 18:25 (`campaign_id ae0a3683`, `scheduled_at 21:26:30`) **nunca são alcançadas** — ficarão `pending` para sempre enquanto o lixo antigo existir.

## Correção

### 1. Migration: corrigir `claim_pending_wa_messages` para filtrar por campanha ativa

Substituir a RPC para já ignorar linhas de campanhas não-ativas no SELECT inicial. Isso resolve o head-of-line blocking permanentemente.

```sql
CREATE OR REPLACE FUNCTION public.claim_pending_wa_messages(p_limit integer DEFAULT 5)
RETURNS SETOF wa_message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.wa_message_queue q
     SET status = 'sending'
   WHERE q.id IN (
     SELECT q2.id
       FROM public.wa_message_queue q2
       LEFT JOIN public.wa_campaigns c ON c.id = q2.campaign_id
      WHERE q2.status = 'pending'
        AND q2.scheduled_at <= now()
        AND (q2.campaign_id IS NULL OR c.status = 'active')
      ORDER BY q2.scheduled_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END$function$;
```

### 2. Migration: limpar lixo histórico

Marcar como `cancelled` todas as linhas `pending` cuja campanha está em `finished` / `error` / `paused` (ou cuja campanha não existe mais). Isso libera a fila e remove o ruído de UI/relatórios.

```sql
UPDATE public.wa_message_queue q
   SET status = 'cancelled',
       error_message = COALESCE(error_message, 'Auto-cancelada: campanha não está ativa')
  FROM public.wa_campaigns c
 WHERE q.status = 'pending'
   AND q.campaign_id = c.id
   AND c.status IN ('finished', 'error', 'paused');
```

(`cancelled` já é um valor usado no domínio? Se houver `CHECK constraint`, conferir antes — caso necessário usar `failed`.)

### 3. Validação

- Após aplicar, invocar `POST /wa-dispatcher` manualmente.
- Esperar `processed >= 1` e as 2 linhas do Blast `ae0a3683` saírem de `pending` (para `sending` → `sent` ou erro real).
- Olhar `wa_send_log` para confirmar entrega.
- Conferir UI do blast: contadores devem refletir Enviadas=2 / Pendentes=0.

## O que NÃO mexer

- Lógica de envio (`sendText`, `sendMedia`, EvoGo), cron schedule, `wa-group-blast` (criação está correta).
- Reconciler (`wa-delivery-reconciler`) — comportamento de marcar como `pending` após `not_found` continua, mas agora só afeta campanhas ativas.

## Detalhes técnicos (cont.)

- Arquivo da RPC: pública, `SECURITY DEFINER`, sem alteração de assinatura — chamadas existentes continuam funcionando.
- Não há mudança em frontend.
- Sem impacto em RLS (RPC é definer).
