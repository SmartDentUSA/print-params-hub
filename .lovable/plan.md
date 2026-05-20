## Problema

1. **`Horas/dia` não persiste** — o campo existe e o `handleSave` envia `duration_hours_per_day`, mas todos os cursos no banco estão com `NULL`. Causa raiz provável: o usuário não preenche esse campo manualmente porque ele duplica informação que já existe nos **horários por dia da turma** (`start_time`/`end_time`). Mesmo se preenchesse, ele precisaria reeditar em cada curso para o certificado funcionar.
2. **`{{carga_horaria}}` no certificado fica vazio** — a edge function só calcula `hoursPerDay * durationDays` quando `duration_hours_per_day` está preenchido (que é sempre `null` hoje).

## Solução

Tornar `horas_dia` e `carga_horaria` **derivados automaticamente** dos horários de cada dia da turma (que o usuário já preenche), eliminando o campo manual como fonte de verdade.

### 1. Edge function `generate-certificate`
- Buscar os dias da turma com `start_time` e `end_time` (já busca `date` em `smartops_turma_days`; expandir para incluir os horários).
- Calcular `hoursPerDay` como a **média** das horas de cada dia (`(end_time - start_time)` em horas, média entre dias). Se todos forem iguais, vira o valor inteiro; se variarem, formatar com 1 casa decimal.
- Calcular `cargaHoraria` como a **soma** das horas de todos os dias (mais preciso que `dias × horas`).
- Fallback: se algum dia não tiver horários, usar o `duration_hours_per_day` do curso; se nem isso existir, omitir as variáveis (render como vazio, sem quebrar o template).
- Atualizar `vars.horas_dia` e `vars.carga_horaria` no loop de pessoas.
- `body_text` continua entrando no snapshot, então PDFs antigos regeneram automaticamente.

### 2. UI `CourseCreateModal.tsx`
- **Manter** o input "Horas/dia" como override opcional (texto auxiliar: "Opcional — calculado automaticamente pelos horários da turma quando vazio").
- **Atualizar o `certificatePreview`** para calcular `horas_dia` e `carga_horaria` a partir dos `start_time`/`end_time` da primeira turma, com a mesma lógica da edge function. Assim a pré-visualização bate com o PDF real.

### 3. Sem migration
Nenhuma mudança de schema. O campo `duration_hours_per_day` continua existindo apenas como override.

## Detalhes técnicos

- Helper compartilhado (inline na edge function e replicado no preview do modal):
  ```ts
  function hoursBetween(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  }
  ```
- Formatar números: inteiros sem decimal (`8`), fracionários com `.toFixed(1).replace(/\.0$/, "")`.
- Edge function: query `smartops_turma_days` passa a selecionar `date, start_time, end_time`.

## Fora de escopo

- Não remove o campo do banco nem da UI (mantém como override).
- Não muda layout do certificado nem do template.
- Não mexe em outras variáveis (`{{nome}}`, `{{local}}`, etc.).