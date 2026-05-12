## Problema

O lead `Zenobio Lopes Mendonça Junior` (`odontozen@outlook.com`) foi criado no `lia_attendances` em 07/05/2026 pela função `astron-postback`, mesmo já existindo o cliente real `odontozen@outlook.com.br` (Deal ganho #59499056). Como os e-mails diferem (.com vs .com.br), o postback não casou e fez `INSERT`. Em seguida, downstream criou o Deal #59696317 no PipeRun, gerando duplicidade e quebrando a regra: **eventos da Astron NUNCA podem criar lead nem Deal.**

## Causa raiz

`supabase/functions/astron-postback/index.ts` faz `INSERT` em `lia_attendances` quando não encontra match por e-mail (linhas 215-243). Isso vale para qualquer evento Astron — inclusive `usercourseprogresschange`, `userlogin`, `userlessonwatch`, etc., que são puramente comportamentais e não comerciais.

## Correção

### 1. `astron-postback`: política "update-only"

- Buscar lead existente com cascata de identidade:
  1. `email` exato
  2. `email` normalizado (lowercase, trim, remover `.` antes do `@` para Gmail)
  3. fallback por telefone normalizado se houver
  4. variação de domínio (`@outlook.com` ↔ `@outlook.com.br`, `@hotmail.com` ↔ `@hotmail.com.br`) **somente** se o restante do local-part bater 100%
- Se encontrou → `UPDATE` apenas campos `astron_*`, `astron_courses_access`, `astron_courses_completed`, `astron_last_*`, `raw_payload` e timeline.
- Se NÃO encontrou → **NÃO inserir.** Registrar em nova tabela `astron_unmatched_events` (email, event_type, payload, created_at) para auditoria/recovery manual e retornar `200 {status:"skipped", reason:"no_matching_lead"}`.
- Bloquear *qualquer* INSERT mesmo no fallback `23505`.

### 2. Reforçar guardrail de criação de Person/Deal

- Em `lia-assign` e `piperun-retry-failed-leads`, adicionar exclusão dura: se `source IN ('astron_postback','sync_astron_members')` **e** `piperun_id IS NULL` **e** sem `form_name` → abortar antes de qualquer chamada à API PipeRun, mesmo que `commercial_override` venha setado por engano.
- Garantir que o `commercial-intent` já cobre isto (cobre), mas adicionar log explícito `astron_no_create_policy` para visibilidade.

### 3. Limpeza dos órfãos atuais

- Migration de dados (via `insert tool`):
  - Mesclar `88c5d9c3-...` (`odontozen@outlook.com`) em `cabee805-...` (`odontozen@outlook.com.br`) usando o motor de merge existente (`merged_into` + cópia de campos `astron_*`).
  - Marcar Deal PipeRun #59696317 para revisão (status `perdida` motivo `duplicado_astron`) via job manual — listar no relatório, **não** deletar automaticamente.
- Varrer todos os `lia_attendances` com `source='astron_postback' AND piperun_id IS NOT NULL AND created_at >= '2026-04-01'` e gerar relatório CSV em `/mnt/documents/astron_orphan_deals.csv` para o time comercial revisar.

### 4. Memória

- Atualizar `mem://architecture/commercial-intent-guard` (ou criar `mem://integration/astron/no-create-policy`) com a regra: **Astron events são update-only; nunca criam `lia_attendances` nem Deals.**

## Arquivos afetados

- `supabase/functions/astron-postback/index.ts` (refator do upsert)
- `supabase/functions/_shared/commercial-intent.ts` (guard reforçado)
- `supabase/functions/smart-ops-lia-assign/index.ts` (log explícito)
- Nova migration: tabela `astron_unmatched_events` + RLS service-role
- Script one-shot de merge para o registro do Zenobio
- Memória do projeto

## Não-objetivos

- Não mexer em `sync-astron-members` agora (já é "enriquece se existir"); apenas validar.
- Não tocar no fluxo de cursos/Academy do frontend.
- Não criar UI nova.
