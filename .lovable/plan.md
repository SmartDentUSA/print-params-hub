# Regenerar certificado quando título do curso muda

## Problema

Hoje `generate-certificate` faz skip quando `certificate_pdf_path` já existe (e `regenerate=false`), retornando o PDF antigo. Se o título do curso (ou local/datas) foi alterado depois, o usuário continua vendo o certificado defasado ao clicar em "Abrir certificado".

## Solução

Guardar um **snapshot dos campos renderizados** no momento da geração e comparar com os valores atuais na próxima requisição. Se algum campo mudou → regerar automaticamente, mesmo com `regenerate=false`.

Campos do snapshot: `course_title`, `location`, `date_text`, `student_name` (para acompanhantes também).

## Mudanças

### 1. Migração — adicionar coluna de snapshot

- `smartops_course_enrollments.certificate_render_snapshot jsonb`
- `smartops_enrollment_companions.certificate_render_snapshot jsonb`

Formato:
```json
{ "course_title": "...", "location": "...", "date_text": "...", "student_name": "..." }
```

### 2. Edge function `generate-certificate/index.ts`

- Selecionar também `certificate_render_snapshot` no query de enrollments e companions.
- Construir `currentSnapshot = { course_title, location, date_text, student_name }` por pessoa.
- Lógica de skip atualizada:
  ```
  const isStale = !person.render_snapshot
    || person.render_snapshot.course_title !== currentSnapshot.course_title
    || person.render_snapshot.location     !== currentSnapshot.location
    || person.render_snapshot.date_text    !== currentSnapshot.date_text
    || person.render_snapshot.student_name !== currentSnapshot.student_name;

  if (existing_path && !regenerate && !isStale) { skip }
  ```
- Ao gerar, `update` também grava `certificate_render_snapshot: currentSnapshot`.
- Status de retorno: usar `regenerated_stale` quando regerar por mudança detectada (vs `generated` na primeira vez), para o toast diferenciar.

### 3. Frontend `SmartOpsCourses.tsx`

Nenhuma mudança na chamada (`regenerate: false` continua). Apenas ajustar o toast para reconhecer `status === 'regenerated_stale'` e mostrar "Certificado atualizado (título do curso mudou)".

## Detalhes técnicos

- Comparação por igualdade estrita de strings já é suficiente (mesma função `formatDateRange` gera o `date_text`, então datas iguais → string igual).
- Upload usa `upsert: true`, então sobrescrever o PDF no mesmo path é seguro.
- Companions herdam `course_title/location/date_text` do enrollment, então o mesmo `isStale` detecta mudanças no curso para acompanhantes também.
- Sem mudança no schema da função (mesmo input/output), apenas comportamento interno.

## Não-objetivos

- Não tocar layout do PDF nem em fontes.
- Não adicionar UI de "forçar regerar" — o botão "Abrir certificado" agora é auto-corretivo.
