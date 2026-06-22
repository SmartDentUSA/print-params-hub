## Objetivo

Para cursos com `modality = 'online_ao_vivo'` ou `'online'`, além da mensagem de confirmação no agendamento (já implementada), enviar **automaticamente um lembrete pelo WhatsApp do CS responsável 1 hora antes do início** da sessão.

## Escopo

- Apenas modalidades online (`online_ao_vivo` e `online`). Presencial não recebe lembrete automático.
- Envio único por enrollment, pela mesma `waleads_api_key` do CS que fez o agendamento.
- Idempotente: nunca envia duas vezes para o mesmo enrollment.

---

## 1. Migration (DB)

Adicionar em `smartops_course_enrollments`:

- `wa_reminder_sent_at timestamptz` — marca envio do lembrete.
- `wa_reminder_error text` — erro do último envio, se houver.
- `wa_reminder_scheduled_for timestamptz` — calculado no insert (1h antes do `start_time` do 1º dia da `turma_snapshot`), para indexar/consultar rápido.
- `cs_team_member_id uuid` — guarda quem agendou (hoje só temos `created_by = auth.user.id`), necessário para o cron achar a `waleads_api_key` do CS sem depender de `csEmail` em runtime.

Índice parcial: `(wa_reminder_scheduled_for) WHERE wa_reminder_sent_at IS NULL AND status = 'agendado'`.

## 2. `src/lib/courseWhatsapp.ts`

Adicionar:

- `DEFAULT_REMINDER_TEMPLATE` — mensagem curta de lembrete (1h antes), variáveis: `{{nome}}`, `{{curso}}`, `{{horario_inicio}}`, `{{link_reuniao}}`, `{{grupo_whatsapp}}`, `{{cs_nome}}`.
- `buildReminderMessage(course, turma, days, personName, csName)` reaproveitando `interpolateTemplate`.

Template proposto:

```
Olá, {{nome}}! 👋

Lembrete: seu treinamento *{{curso}}* começa em 1 hora, às {{horario_inicio}}.

{{link_reuniao}}

{{grupo_whatsapp}}

Até já!
*{{cs_nome}}*
```

## 3. `src/hooks/useEnrollment.ts`

No INSERT do enrollment:

- Calcular `wa_reminder_scheduled_for` = `turma_snapshot.days[0].date + start_time - 1h` (timezone America/Sao_Paulo) somente quando `course.modality ∈ {online_ao_vivo, online}`. Caso contrário `null`.
- Buscar `team_members.id` do CS via `email = user.email` e gravar em `cs_team_member_id`.

## 4. Edge function `smartops-send-course-reminder` (nova)

Cron-driven. A cada execução:

1. `SELECT` em `smartops_course_enrollments` onde:
   - `status = 'agendado'`
   - `wa_reminder_sent_at IS NULL`
   - `wa_reminder_scheduled_for BETWEEN now() AND now() + interval '5 minutes'`
   - `JOIN smartops_courses` com `modality IN ('online_ao_vivo','online')` (defesa em profundidade).
2. Para cada enrollment:
   - Buscar `team_members` por `cs_team_member_id` → `waleads_api_key`, `nome_completo`.
   - Buscar `lia_attendances.telefone` por `lead_id` (com `merged_into IS NULL`).
   - Renderizar `DEFAULT_REMINDER_TEMPLATE` com `buildTemplateVars` (mesmo helper, modo lembrete).
   - Chamar `smart-ops-send-waleads` com `source: 'enrollment_reminder_1h'`.
   - Atualizar `wa_reminder_sent_at` ou `wa_reminder_error`.

Inclui CORS, validação Zod do payload (vazio aceito), e proteção contra reentrância (`UPDATE ... WHERE wa_reminder_sent_at IS NULL RETURNING id` antes de enviar).

## 5. Agendamento (pg_cron)

`pg_cron` job a cada 5 minutos invocando `smartops-send-course-reminder` via `pg_net.http_post` (padrão já usado no projeto).

## 6. Backfill

Migration popula `wa_reminder_scheduled_for` dos enrollments existentes (futuros, online) a partir de `turma_snapshot->days[0]`.

---

## Fora de escopo

- Notificações por e-mail/SMS.
- Lembretes para presencial.
- Múltiplos lembretes (24h, 30min). Apenas 1h antes.
- Edição do template via UI (usa `DEFAULT_REMINDER_TEMPLATE` fixo; pode ser estendido depois via coluna `whatsapp_reminder_template` no curso, se solicitado).
