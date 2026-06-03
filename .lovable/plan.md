## Diagnóstico

Verifiquei a tabela `smartops_course_enrollments` e seus triggers. O último agendamento gravado foi em **28/05/2026** — nenhum INSERT bem-sucedido desde então, embora o usuário esteja clicando em "Confirmar".

Nos logs do Postgres aparecem, recorrentes nas últimas horas:

```
function net.http_post(url => unknown, headers => jsonb, body => text) does not exist
```

### Causa raiz

O trigger `trg_wa_treinamento_agendado` (AFTER INSERT) chama a função `fn_notify_treinamento_agendado`, que invoca:

```sql
net.http_post(
  url     := 'https://.../cs-treinamento-agendado',
  headers := '{...}'::jsonb,
  body    := jsonb_build_object('enrollment_id', NEW.id)::text   -- ❌ text
);
```

A assinatura real do `pg_net` é `(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int)`. Como a função passa `body` como **text**, o Postgres não resolve nenhum overload e lança `ERROR`. Por ser AFTER trigger sem `EXCEPTION` block, a exceção propaga e **faz rollback do INSERT inteiro** — o agendamento nunca é gravado, mas o frontend pode receber resposta confusa porque o cliente PostgREST do `.insert().select().single()` retorna erro do trigger (provavelmente vindo como toast genérico que o usuário não associa ao trigger).

Os demais triggers (`fn_enrollment_writeback`, `fn_sync_enrollment_count`, `set_updated_at`) estão íntegros.

## Correção

**Nova migration** recriando `public.fn_notify_treinamento_agendado` com dois ajustes:

1. Passar `body` como `jsonb` (sem `::text`), na ordem correta dos parâmetros nomeados do `pg_net`.
2. Envolver a chamada em `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END` que apenas loga em `system_health_logs` (`error_type='enrollment_notify_failed'`) e **nunca propaga** — assim qualquer falha futura na função edge `cs-treinamento-agendado` ou no pg_net jamais voltará a bloquear o INSERT do agendamento.

```sql
CREATE OR REPLACE FUNCTION public.fn_notify_treinamento_agendado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'agendado'
     AND (OLD.status IS DISTINCT FROM 'agendado')
     AND NEW.wa_sent_at IS NULL
     AND NEW.lead_id IS NOT NULL
  THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/cs-treinamento-agendado',
        body    := jsonb_build_object('enrollment_id', NEW.id),
        headers := '{"Content-Type":"application/json"}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.system_health_logs(error_type, error_message, context)
      VALUES ('enrollment_notify_failed', SQLERRM,
              jsonb_build_object('enrollment_id', NEW.id, 'sqlstate', SQLSTATE));
    END;
  END IF;
  RETURN NEW;
END;
$$;
```

## Validação pós-migration

1. Rodar um INSERT de teste manual em `smartops_course_enrollments` e confirmar que a linha persiste.
2. Pedir ao usuário para tentar agendar novamente — esperar `status='agendado'` gravado e toast "Agendamento confirmado!".
3. Conferir `system_health_logs` por `error_type='enrollment_notify_failed'` (se a edge function ainda tiver problema, agora apenas loga sem travar).

## Fora de escopo

- O erro `column v.closed_at does not exist` vem de `check_copilot_brain_drift` (Copilot Brain) — não tem relação com agendamento e fica para outra tarefa.
- Nenhuma mudança de frontend.
