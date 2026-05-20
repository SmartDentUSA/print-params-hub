## Problema
Os dropdowns padronizados de **Especialidade** e **Área de Atuação** foram aplicados no modal de Agendamento novo (`EnrollmentModal`), mas **não** no diálogo de **Editar Inscrição** (`EditEnrollmentDialog` em `src/components/SmartOpsCourses.tsx`, linhas 597–598), que ainda usa `<Input>` texto livre. Também faltou no formulário de adicionar acompanhante dentro do `EnrollmentModal` (linhas 120/124), que igualmente continua como `<Input>`.

## Mudanças

### 1. `src/components/SmartOpsCourses.tsx` — `EditEnrollmentDialog`
- Importar `AREA_ATUACAO_OPTIONS`, `ESPECIALIDADE_OPTIONS`, `canonicalize` de `@/lib/dentalTaxonomy` e `Select*` do shadcn (provavelmente já importado para Status).
- Trocar os 2 `<Input>` das linhas 597–598 por um `<Select>` reaproveitando o mesmo padrão do `TaxonomySelect` do `EnrollmentModal`. Para não duplicar código, **extrair** `TaxonomySelect` para um arquivo compartilhado `src/components/smartops/TaxonomySelect.tsx` e importar nos dois lugares.
- Comportamento: se `form.especialidade` / `form.area_atuacao` já tiver valor que não bate com nenhuma opção (dado legado), renderizar como opção `(atual) <valor>` no topo, igual ao EnrollmentModal. Não perde dado.

### 2. `src/components/smartops/EnrollmentModal.tsx` — formulário de novo acompanhante
- Trocar `<Input>` de `area_atuacao` (linha 120) e `especialidade` (linha 124) do `CompanionForm` por `TaxonomySelect` (mesmo componente extraído).

### 3. Novo: `src/components/smartops/TaxonomySelect.tsx`
- Move o componente `TaxonomySelect` que hoje vive inline no `EnrollmentModal.tsx` para arquivo próprio, exportado.
- `EnrollmentModal.tsx` passa a importar dele.

## Fora de escopo
- Lista de acompanhantes no `EditEnrollmentDialog` continua readonly (badges) — não há edição inline hoje, manter como está.
- Não migrar dados legados no banco.
- Não tocar na edge function de DOCX nem em outros lugares do app.

## Validação
- Abrir "Editar inscrição" em um inscrito com `especialidade = "ORTODONTISTA"` → dropdown vem selecionado.
- Abrir inscrito com valor legado fora da lista (ex.: `"Cirurgião"`) → aparece como `(atual) Cirurgião` selecionado.
- Alterar e salvar grava o `value` canônico (UPPERCASE) em `smartops_course_enrollments.especialidade` / `area_atuacao`.
- No modal de Agendamento, adicionar acompanhante → campos de área e especialidade aparecem como dropdown.
