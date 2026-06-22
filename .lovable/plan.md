## Problema

"Excluir curso" falha silenciosamente (ou com erro) em cursos recorrentes como "Teste 02" porque existem foreign keys sem `ON DELETE CASCADE` apontando para `smartops_course_turmas`:

- `smartops_course_turmas.recurrence_parent_id` (auto-referência) — bloqueia delete do turma-pai enquanto filhos referenciam.
- `wa_groups.turma_id`
- `training_factory_runs.turma_id`
- `training_factory_assets.turma_id`
- `smartops_course_enrollments.turma_id` (sem cascade)

Hoje o `deleteCourse` em `src/components/SmartOpsCourses.tsx` só apaga `smartops_turma_days` e `smartops_course_turmas`, então qualquer linha nas tabelas acima dispara erro de FK e nada acontece visualmente.

## Correção (frontend apenas, em `SmartOpsCourses.tsx` → `deleteCourse`)

Antes de deletar as turmas, na ordem:

1. `update smartops_course_turmas set recurrence_parent_id = null where recurrence_parent_id in (turmaIds)` — quebra auto-FK.
2. `update wa_groups set turma_id = null where turma_id in (turmaIds)`.
3. `update training_factory_runs set turma_id = null where turma_id in (turmaIds)`.
4. `update training_factory_assets set turma_id = null where turma_id in (turmaIds)`.
5. `delete from smartops_course_enrollments where turma_id in (turmaIds)` (já validamos enrolled_count = 0; cobre eventuais órfãos cancelados).
6. `delete from smartops_turma_days where turma_id in (turmaIds)` (já existe).
7. `delete from smartops_course_turmas where id in (turmaIds)` (já existe).
8. `delete from smartops_courses where id = c.id` (já existe).

Também: surfacing real do erro caso ocorra — fazer `await` em cada passo e jogar no `catch` já existente (que mostra toast). Hoje os 2 deletes iniciais não tratam erro; envolver com checagem `if (error) throw error`.

## Fora de escopo

- Mudar FKs no banco (migration) — pode ser feito depois se quiser cascade global; nesta correção fica só no client.
- Editor de curso, agenda pública, outras telas.
