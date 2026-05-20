## Diagnóstico

O texto do certificado **é salvo corretamente no banco** (confirmado em `smartops_courses.certificate_body_template` para o curso "Chairside Print"). O problema é só na **leitura**: o select da lista de cursos em `SmartOpsCourses.tsx` (linha 278-290) não inclui o campo `certificate_body_template`.

Quando o usuário reabre o curso pra editar, o `course` passado ao `CourseCreateModal` vem **sem** esse campo. O `useEffect` da linha 269 então executa:

```ts
setCertificateBody(course.certificate_body_template || DEFAULT_CERTIFICATE_BODY);
```

Como `certificate_body_template` é `undefined`, cai no DEFAULT. Resultado: o textarea sempre mostra o texto padrão, dando a impressão de que a edição não persistiu.

O mesmo problema afeta outros campos que o modal lê mas o select não traz:
- `certificate_body_template`
- `duration_hours_per_day`
- `whatsapp_message_template`
- `pipeline_id_kanban`
- `stage_after_enroll`
- `description`

## Correção

Adicionar esses campos faltantes ao `select` da query `["smartops_courses"]` em `src/components/SmartOpsCourses.tsx` (linha 278). Uma linha só, sem migration, sem mexer em edge function.

```ts
.select(`
  id, title, slug, modality, category, instructor_name,
  cover_image_url, max_capacity, duration_days, duration_hours_per_day,
  location, meeting_link, active, public_visible, description,
  certificate_body_template, whatsapp_message_template,
  pipeline_id_kanban, stage_after_enroll,
  recurrence_enabled, recurrence_type, recurrence_interval,
  recurrence_until, recurrence_time_start, recurrence_time_end,
  whatsapp_group_link,
  turmas:smartops_course_turmas (...)
`)
```

## Fora de escopo

Não mexer no `handleSave`, no modal, nem na edge function — todos já estão corretos.