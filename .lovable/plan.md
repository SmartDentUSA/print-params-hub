

## Atualizar `astron-postback` para formato real do Astron

### Problema
O código atual espera payload nested (`body.user.email`), mas o Astron envia campos flat (`body.email`, `body.event`).

### Alteração: `supabase/functions/astron-postback/index.ts`

Reescrever a lógica de parsing para:

1. **Evento**: ler `body.event` (valores: `useradd`, `usercourseprogresschange`, `newcomment`, `newsupportticket`)
2. **Token**: validar `body.token` contra `ASTRON_POSTBACK_TOKEN`
3. **Email**: extrair de `body.email` ou `body.user_email` (flat)
4. **Campos por evento**:
   - `useradd`: `name`, `email`, `phone`, `login_url`, `insert_time`, UTMs (`utm_campaign`, `utm_source`, `utm_medium`, `utm_content`, `utm_term`), Facebook IDs (`fbc`, `fbp`)
   - `usercourseprogresschange`: `user_name`, `user_email`, `course_name`, `course_id`, `course_total_classes`, `user_course_completed_classes`, `user_course_percentage`
   - `newcomment`: `user_name`, `user_email`, `course_name`, `comment`
   - `newsupportticket`: `user_name`, `user_email`, `ticket_subject`, `ticket_message`
5. **Upsert em `lia_attendances`**: mesma lógica de find-by-email, update ou insert
6. **Progresso de curso**: salvar detalhes no campo JSONB `astron_courses_access` como array de objetos `{ course_id, course_name, percentage, completed_classes, total_classes, updated_at }`

### Sem alterações de banco de dados
Os campos `astron_*` e `astron_courses_access` (jsonb) já existem na tabela.

