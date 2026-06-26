
## Objetivo

No formulário público de inscrição de treinamento online (`/curso/:slug`):

- **"Sou cliente Smart Dent"** → mantém fluxo atual (inscrição → NPS). Sem alteração.
- **"Não sou cliente Smart Dent"** → após Nome/E-mail/Telefone, abrir um **questionário sequencial idêntico aos formulários públicos do sistema** (mesmo motor do `parametros.smartdent.com.br/f/ios-blz-ino200`), com condicionais (área, especialidade, scanner, contato com 3D, modelo de scanner, modelo de impressora, resinas) e mapeamento para `lia_attendances` + custom fields PipeRun + células do Workflow 7×3. A submissão entra no pipeline normal de formulário (cria/atualiza lead + Deal no VENDAS via Golden Rule).

## Como funciona hoje

- `src/pages/PublicCourseEnrollment.tsx` coleta só Nome/E-mail/Telefone e chama `smartops-public-enrollment` (matrícula + conversion history). Não cria Deal nem qualifica.
- `src/pages/PublicFormPage.tsx` é o renderer dos forms do sistema: lê `smartops_forms` + `smartops_form_fields`, aplica `isFieldVisible` (engine em `src/lib/formConditions.ts`) para condicionais e mapeia `db_column` / `custom_field_name` / `workflow_cell_target`. Submissão vai para o ingest normal que cria Deal com origem = `form_name`.

## Decisão de arquitetura

**Um único form global** reutilizado por todos os cursos online, sem override por curso. **Produto de interesse do lead e das células do Workflow 7×3 vem do(s) produto(s) relacionado(s) cadastrados no editor do treinamento** (`smartops_courses.related_product_ids` / `related_product_names`) — não do form.

## Schema (1 migração)

1. Criar `smartops_forms` slug = `curso-online-qualificacao` (singleton, ativo, `form_purpose = 'qualificacao_curso'`).
2. Inserir `smartops_form_fields` com a sequência da especificação:
   - #4 Cargo (custom field)
   - #5 Área de atuação (`db_column = area_atuacao`)
   - #6 Especialidade — condicional: `#5 ≠ LABORATÓRIO DE PRÓTESE`
   - #7 Tem scanner? (`db_column = tem_scanner`)
   - #8 Contato com impressão 3D — condicional: `#7 = AINDA NÃO DIGITALIZO`
   - #9 Tipo de clínica — condicional: `#5 = CLÍNICA OU CONSULTÓRIO`
   - **Mapeamento Workflow 7×3** (#1–#8): Scanner Intraoral / Scanner Bancada / CAD / Impressora 3D / Resinas, cada um com `workflow_cell_target` e `show_if` exatos descritos pelo usuário.
3. Em `smart-ops-ingest-lead`: quando `source = "course_enrollment_public"`, **sobrescrever `produto_interesse_auto` com `course.related_product_names[0]`** e popular as células Workflow 7×3 de produtos (scanner/impressora/resinas) usando os IDs do curso quando o campo correspondente for respondido como "tenho equipamento" — produto do curso é fonte da verdade.

Nenhuma coluna nova em `smartops_courses` (usa `related_product_ids`/`related_product_names` já existentes).

## Frontend — `PublicCourseEnrollment.tsx`

Novo estado de etapas:

```text
1. Identificação (nome, email, telefone)        ← existe
2. "É cliente Smart Dent?" (sim/não)            ← existe
   ├─ SIM  → smartops-public-enrollment → NPS   ← existe, intocado
   └─ NÃO  → <QualificationFormInline
                slug="curso-online-qualificacao"
                prefill={{nome,email,telefone}}
                extraContext={{
                  course_id, course_title, course_slug, turma_id,
                  related_product_ids, related_product_names,
                  form_name_override: `# - ${course.title}`,
                  source: "course_enrollment_public"
                }} />
              → on submit: ingest do form roda → matrícula é criada → tela final (sem NPS)
```

Refatorar a renderização de campos do `PublicFormPage` em componente reutilizável **`src/components/forms/QualificationFormInline.tsx`** que:

- Carrega `smartops_form_fields` pelo slug.
- Aplica `isFieldVisible` para o sequenciamento condicional.
- Pré-preenche e oculta nome/email/telefone já coletados.
- No submit, chama `smart-ops-ingest-lead` com `form_name = "# - <course title>"`, payload completo das respostas, workflow cells, `related_product_ids/names` do curso, e em seguida chama `smartops-public-enrollment` (modo non-client) com o `lead_id` retornado.

## Backend — `smartops-public-enrollment`

Ajustes mínimos:

- Quando `is_client_smartdent = false`, exigir `lead_id` já criado pelo ingest do form (passado no payload). Apenas grava matrícula + conversion history + activity log.
- Quando `is_client_smartdent = true`, mantém fluxo atual integral (inclui NPS no front).

## Backend — `smart-ops-ingest-lead`

Quando `source = "course_enrollment_public"`:

- Garante `form_name = "# - <course title>"` (origem do Deal no PipeRun via `resolveOriginId`).
- Força `produto_interesse_auto = related_product_names[0]` (do curso, ignora qualquer inferência por keyword).
- Para cada célula 7×3 de produto preenchida (`workflow_cell_target` ∈ scanner/impressora/resinas), grava o produto do curso correspondente como item da célula, em vez de inferir pelo texto da resposta.

Golden Rule, criação de Deal e custom fields PipeRun seguem o caminho normal — nenhuma exceção.

## Comportamento esperado pós-mudança

- Lead novo via "Não sou cliente" entra com qualificação completa, custom fields PipeRun (Scanner formulário, Impressora formulário, Área, Especialidade), células 7×3 preenchidas, **Deal criado no VENDAS** com origem `# - <título do curso>` e produto de interesse vindo do curso.
- Matrícula + conversion history continuam sendo gravadas.
- "Sou cliente" segue intocado → NPS.

## Itens técnicos

- **Arquivos novos:** `src/components/forms/QualificationFormInline.tsx`.
- **Arquivos editados:** `src/pages/PublicCourseEnrollment.tsx`, `supabase/functions/smartops-public-enrollment/index.ts`, `supabase/functions/smart-ops-ingest-lead/index.ts` (branch `source = course_enrollment_public`).
- **Migração:** seed do form `curso-online-qualificacao` + fields/condicionais.
- **Sem alteração** no motor de formulários, na Golden Rule, no PipeRun sync, no fluxo "Sou cliente", em `smartops_courses` schema, ou em matrícula/turma.
