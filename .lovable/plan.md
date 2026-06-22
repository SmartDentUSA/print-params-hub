## Verificação — Mensagem de Agendamento (WhatsApp)

O template que você quer enviar **já é exatamente o `DEFAULT_ENROLLMENT_TEMPLATE`** em `src/lib/courseWhatsapp.ts`. Todas as variáveis (`{{nome}}`, `{{curso}}`, `{{turma_label}}`, `{{instrutor}}`, `{{local}}`, `{{cronograma}}`, `{{link_reuniao}}`, `{{grupo_whatsapp}}`, `{{cs_nome}}`) já são preenchidas por `buildTemplateVars` e enviadas via `smart-ops-send-waleads` no passo 7 do `useEnrollment`.

**Conclusão:** não há mudança de código a fazer — o conteúdo enviado já bate 1:1 com o que você pediu.

---

## Plano de validação (sem alterar código)

Quero apenas confirmar em produção que cada variável está chegando preenchida (nada vazio, nada faltando).

### 1. Auditoria via SQL — últimos 10 agendamentos
Conferir em `smartops_course_enrollments` + `smartops_courses` + `smartops_course_turmas` se as fontes das variáveis estão populadas:
- `course.title` → `{{curso}}`
- `turma.label` → `{{turma_label}}`
- `course.instructor_name` → `{{instrutor}}`
- `resolveLocal(course)` → `{{local}}`
- `turma_snapshot.days` → `{{cronograma}}`
- `course.meeting_link` → `{{link_reuniao}}` (só cursos online)
- `turma.whatsapp_group_link || course.whatsapp_group_link` → `{{grupo_whatsapp}}`
- `wa_sent_at` preenchido (sucesso) e `wa_error` nulo

### 2. Checar `whatsapp_send_queue` / logs de `smart-ops-send-waleads`
Pegar a última 1 inscrição com `source='enrollment_confirmation'` e ler o `message` final renderizado para confirmar que nenhuma variável ficou como `{{...}}` literal.

### 3. Se algo vier vazio
Reportar qual campo do card precisa ser preenchido pelo CS (ex.: turma sem `whatsapp_group_link`, curso sem `instructor_name`) — **não** mexer no template.

### Fora de escopo
- Alterar `DEFAULT_ENROLLMENT_TEMPLATE`
- Adicionar novas variáveis (acompanhantes, equipamentos, contrato, etc.)
- Tocar em `smart-ops-send-waleads`, `useEnrollment`, ou no editor de template no `CourseCreateModal`

---

**Aprovo isso e parto só para a auditoria SQL/logs?** Se um curso/turma específico já apresentou problema, me passe o `enrollment_id` ou nome do participante para eu focar nele.