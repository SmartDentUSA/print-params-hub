## Objetivo

Refletir no card do Deal (PipeRun) **todas as informações** vinculadas à inscrição do aluno: treinamento, turma, grupo de WhatsApp, e tudo que o time de CS preenche (contrato, proposta, NF, instagram, tipo de entrega, rastreamento, observações, etc.).

## Diagnóstico

- A nota "Resumo do Lead" (postada via `smart-ops-deal-form-note` + `_shared/seller-summary.ts`) **já inclui** uma seção "🎓 Cursos & Treinamentos", mas hoje só lista `deal_title`, nome da turma e status — nada de WhatsApp, contrato, NF, rastreamento.
- O fluxo de inscrição (`useEnrollment.ts`) e a edição de inscrição (`EditEnrollmentDialog` em `SmartOpsCourses.tsx`) gravam no banco mas **não disparam** o `smart-ops-deal-form-note`, então a nota no Deal nem é atualizada.

## Correção

### 1. Enriquecer `supabase/functions/_shared/seller-summary.ts`

Expandir a Seção 5 ("🎓 Cursos & Treinamentos"):

- Trocar o `select` por: `id, deal_title, status, enrolled_at, certificate_generated_at, certificate_pdf_path, notes, instagram, numero_contrato, numero_proposta, numero_nf, tipo_entrega, rastreamento, turma_snapshot, turma:smartops_course_turmas(label, start_date, end_date, location, modality, whatsapp_group_link, course:smartops_courses(title))`.
- Para cada matrícula renderizar bloco multilinhas:
  ```
  ◦ {course.title} — Turma {turma.label}
    Data: {start_date}–{end_date} | Local: {location} | Modalidade: {modality}
    Status: {status} | Inscrito em: {enrolled_at}
    Grupo WA: {whatsapp_group_link || "—"}
    Contrato: {numero_contrato} | Proposta: {numero_proposta} | NF: {numero_nf}
    Entrega: {tipo_entrega} | Rastreio: {rastreamento}
    Instagram: {instagram}
    Certificado: {certificate_pdf_path ? "✅ gerado em " + date : "pendente"}
    Notas CS: {notes}
  ```
- Omitir linhas vazias (mostrar só os campos preenchidos).

### 2. Disparar a nota após criar inscrição

Em `src/hooks/useEnrollment.ts`, após o passo 7 (WhatsApp), chamar:

```ts
await supabase.functions.invoke('smart-ops-deal-form-note', {
  body: {
    lead_id: p.dealResult.lead_id,
    form_name: `Inscrição em Treinamento — ${p.course.title}`,
    responses: [
      { label: "Treinamento", value: p.course.title },
      { label: "Turma", value: p.selectedTurma.label },
      { label: "Participante", value: p.formData.person_name },
      { label: "Contrato", value: p.formData.numero_contrato || "—" },
      { label: "Proposta", value: p.numero_proposta || "—" },
      { label: "Instagram", value: p.instagram || "—" },
      { label: "Notas CS", value: p.notes || "—" },
    ],
  },
}).catch((e) => console.warn('[deal-note-enrollment]', e));
```

(Best-effort — não bloqueia o fluxo se falhar.)

### 3. Disparar a nota após edição CS

Em `src/components/SmartOpsCourses.tsx`, dentro de `EditEnrollmentDialog`, após o `update` ser bem sucedido, fazer a mesma invocação com `form_name = "Atualização CS — Inscrição"` e `responses` montadas a partir dos campos editados (apenas os que mudaram, com label legível).

Como a função já tem throttle de 5 min e deduplicação por hash, chamadas redundantes são absorvidas naturalmente.

## Detalhes técnicos

- A função `smart-ops-deal-form-note` resolve `piperun_id` retentando até 4× (já implementado) — atende inscrição imediatamente após criação do deal.
- O `seller-summary` já é cached por hash; só re-posta quando o conteúdo realmente muda.
- Sem migration: todos os campos enriquecidos já existem em `smartops_course_enrollments` e `smartops_course_turmas`.

## Fora de escopo

- Não alterar PipeRun custom fields (o conteúdo vai como **nota** no deal, conforme já é hoje).
- Não tocar em sync de equipamentos / SellFlux.
- Não mexer no fluxo de geração de certificado.