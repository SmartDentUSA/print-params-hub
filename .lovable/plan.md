# Inscrição Pública para Cursos Online / Workshop / Webinar + NPS

Adicionar página pública de inscrição para cursos cuja modalidade seja **Online ao Vivo**, **Online**, **Workshop** ou **Webinar**, com fluxo diferenciado para clientes Smart Dent (NPS) e não clientes (captura de lead seguindo o padrão atual de formulários).

## 1. Página pública `/inscricao/:courseSlug` (ou `/inscricao/:turmaId`)

- Lista as opções/datas disponíveis (turmas) do curso.
- Formulário curto: **Nome completo**, **E-mail**, **Celular** (com máscara), checkbox de consentimento.
- Após submit, pergunta "**É cliente Smart Dent?**" (Sim / Não).
  - Decisão guiada pelo back-end: se o e-mail/telefone bater com `lia_attendances` que tenha `piperun_id` ou `omie_cliente_id` (cliente real), forçamos "Sim" e exibimos NPS.
  - Caso contrário, oferecemos a pergunta + permitimos auto-declaração.
- Validação com `zod`: nome ≥ 3, e-mail válido, telefone BR (10–11 dígitos).
- Rate-limit por IP usando `smart_form_rate_limit`.

## 2. Fluxo "Cliente Smart Dent = Sim" → NPS nativo

Formulário com 3 perguntas de 5 estrelas (espelho da imagem):
1. Nível de satisfação com a Smart Dent
2. Qualidade dos treinamentos recebidos até o momento
3. Probabilidade de recomendar (NPS clássico)
- Campo e-mail (pré-preenchido)
- Campo livre opcional "Comentário"

Resposta salva em nova tabela `smartops_nps_responses` ligada a `enrollment_id` + `lead_id`.
A inscrição é confirmada normalmente (cria enrollment, dispara WhatsApp de confirmação + lembrete 1h já existente).

## 3. Fluxo "Não cliente" → captura de lead (padrão dos formulários do sistema)

Antes de criar qualquer registro:

1. **Buscar lead existente** por e-mail OU telefone normalizado em `lia_attendances WHERE merged_into IS NULL` (mesma cascata de identidade usada nos formulários Meta/sistema).
2. Se existir → **enriquece** o lead (sem sobrescrever origem original, conforme `person-origin-frozen`).
3. Se não existir → cria novo lead via edge function `smart-ops-form-ingest` (ou equivalente já usada para forms públicos), com:
   - `form_name = "Inscrição — {course.title}"`
   - `origem_primeiro_contato = "Inscrição Curso"` (apenas no create)
   - `produto_interesse_auto` = produtos vinculados ao curso (`related_product_names`/`related_product_ids` do `smartops_courses`)
4. Registrar em `lead_conversion_history`:
   - `conversion_type = 'inscricao_curso'`
   - `conversion_name = "# - Inscrição [{course.title}]"`
   - `source_entity_id = enrollment.id`
5. Marcar no `lead_activity_log` evento `inscricao_curso_publica`.
6. Cria o enrollment com `status = 'agendado'` e dispara WhatsApp de confirmação + lembrete 1h (fluxo já existente).
7. **Sem NPS** para não clientes.

Importante: respeita o **Commercial Intent Guard** — `form_name` presente + source whitelisted permite criação de Person no PipeRun apenas se houver e-mail OU telefone (sempre teremos).

## 4. Schema

Migration adiciona:

- `smartops_courses.public_enrollment_enabled boolean default false` — liga a página pública apenas quando o admin marcar.
- `smartops_courses.public_slug text unique` — slug amigável (gerado no create se vazio).
- `smartops_course_enrollments.source text default 'admin'` — `'admin' | 'public'`.
- `smartops_course_enrollments.is_client_smartdent boolean`.
- `smartops_course_enrollments.public_form_payload jsonb` — snapshot do que o usuário enviou.
- Nova tabela `smartops_nps_responses` (`id`, `enrollment_id`, `lead_id`, `score_satisfacao`, `score_treinamentos`, `score_recomendacao`, `email`, `comment`, `created_at`) — com RLS e GRANTs (anon insert via edge function service_role; authenticated select).

## 5. Edge functions

- **`smartops-public-enrollment`** (verify_jwt=false, CORS, zod):
  - Input: `course_slug`, `turma_id`, `nome`, `email`, `telefone`, `is_client_smartdent`.
  - Faz lookup de lead, enriquece/cria, registra `lead_conversion_history`, cria enrollment, dispara WA, retorna `{ enrollment_id, show_nps: boolean }`.
- **`smartops-public-nps`** (verify_jwt=false, CORS, zod):
  - Input: `enrollment_id`, scores, email, comment.
  - Insert em `smartops_nps_responses`.

## 6. UI Admin

- No `CourseCreateModal`, quando `modality ∈ {online, online_ao_vivo, workshop, webinar}`:
  - Mostrar toggle **"Abrir inscrições públicas"** → grava `public_enrollment_enabled`.
  - Mostrar o link público copiável após salvar.

## Fora de escopo

- NPS para clientes inscritos por não-clientes (sem `lead_id` válido).
- NPS pós-treinamento (este é NPS de expectativa, na inscrição).
- Página de relatório agregado de NPS (apenas a coleta).
- Editor de perguntas do NPS (template fixo).

## Detalhes técnicos

- **Arquivos novos**: `src/pages/PublicEnrollment.tsx`, `src/pages/PublicEnrollmentNPS.tsx`, `supabase/functions/smartops-public-enrollment/index.ts`, `supabase/functions/smartops-public-nps/index.ts`.
- **Arquivos editados**: `src/App.tsx` (rotas), `src/components/smartops/CourseCreateModal.tsx` (toggle público + link), `src/hooks/useEnrollment.ts` (não muda — fluxo admin segue igual).
- **Identidade do lead**: `piperun_id > email > phone` (memory rule).
- **Origem congelada**: usamos `origem_primeiro_contato` só no create; nunca sobrescrevemos.
- **Timestamps**: `enrolled_at = now()`; `lead_conversion_history.created_at` herda do submit real.
- **CDP**: toda query a `lia_attendances` filtra `merged_into IS NULL`.
