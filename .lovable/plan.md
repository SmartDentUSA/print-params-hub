## Diagnóstico — Lead "ESTÉTICA AVANÇADA" (Deal 59698338)

Investiguei os logs do `smart-ops-lia-assign` e o registro do lead em `lia_attendances` (id `41fccffd…`). Achei **três coisas separadas**, sendo uma delas um bug real e outras duas falhas de regra que precisamos endurecer:

### 1. Bug real: UPDATE final do lead está quebrando com `column "value" does not exist`

Logs (22:46:06):
```
ERROR DB update FAILED for 41fccffd-...: code=42703
       message='column "value" does not exist'
```
Já aconteceu com **3 leads hoje** (22:08, 22:10, 22:46) — `system_health_logs / error_type=lead_update_failed`.

Sequência observada nos logs:
- 22:46:02 → Person 46861496 criada **com email + telefone** (`createPerson` envia `emails:[…]` e `phones:[…]`)
- 22:46:02 → Company 22833508 criada e vinculada à Person
- 22:46:02 → Deal 59698338 criado com `person_id=46861496` e `company_id=22833508`
- 22:46:06 → **UPDATE em `lia_attendances` falha** com 42703

Ou seja: PipeRun **tem** Person ↔ Deal vinculados. O que está incompleto é a **persistência local** do estado pós-criação (alguns campos enriquecidos não voltam pro nosso DB porque o UPDATE inteiro aborta). `pessoa_piperun_id` e `piperun_id` chegaram na linha porque foram gravados antes (caminho do webhook), mas qualquer enriquecimento posterior (`piperun_pipeline_name`, `piperun_stage_name`, `piperun_origin_name`, `empresa_segmento`, etc.) ficou sem salvar.

**Causa provável:** algum campo de `dealEnrichment` ou `companyData` está sendo despejado em `updateFields` com uma chave que não é coluna real (ex.: `value`, ou um custom_field do Piperun retornado como `{value:…}`). Não há nenhum trigger/coluna gerada que referencie `value`, então o erro vem do próprio payload do `.update({...})`.

### 2. Pessoa criada sem `origin_id` no PipeRun

`_shared/piperun-hierarchy.ts → createPerson()` envia apenas `name`, `emails`, `phones`, `job_title`. **Nunca envia `origin_id`.** Por isso, no PipeRun a aba de Pessoa fica com origem vazia, mesmo quando a origem do Deal foi resolvida corretamente (no caso, `# - Impresoras - Smart Dent` → 801240). A origem da Pessoa deveria espelhar a origem da primeira conversão (regra Person vs Deal Origin Separation já documentada).

### 3. Nome da Pessoa = nome da Empresa ("ESTÉTICA AVANÇADA")

O formulário Meta veio com `full_name = "ESTÉTICA AVANÇADA"` (nome de clínica, não pessoa). O `lia-assign` aceitou isso como nome da Pessoa **e** como nome da Empresa. Resultado:
- Person 46861496 → name = "ESTÉTICA AVANÇADA" (sem nome real do contato)
- Company 22833508 → name = "ESTÉTICA AVANÇADA"
- Email `dradianehorst@gmail.com` ficou só na Person, sem nome real associado

Isso é o que faz o usuário olhar o card do Deal e ler "Contato: ESTÉTICA AVANÇADA" — visualmente parece que a pessoa não foi vinculada de verdade.

---

## Plano de correção

### Etapa 1 — Corrigir o bug 42703 (prioridade máxima)

1. Em `supabase/functions/smart-ops-lia-assign/index.ts`, **antes** do `await supabase.from("lia_attendances").update(updateFields)` (linha ~1930):
   - Logar `Object.keys(updateFields)` (uma vez por execução) para identificar a chave inválida em produção sem precisar reproduzir.
   - Aplicar uma **allowlist** de colunas conhecidas em `lia_attendances` (lista estática de ~80 colunas que o lia-assign tem direito de escrever) e descartar (com `console.warn`) qualquer chave fora do conjunto. Isso elimina a classe inteira do bug, não só a instância atual.
2. Investigar `dealEnrichment` (montado a partir de `fetchDealForEnrichment` / `_companyData`) e o trecho `companyFieldMap` (1861-1879) para confirmar a chave problemática — o suspeito mais forte é um custom_field do Piperun retornando `{value: …}` que vaza pra raiz do objeto.
3. Reprocessar os 3 leads afetados (`41fccffd…`, `179d21e1…`, `88e2b29a…`) via `smart-ops-piperun-retry-failed-leads` para completar os campos que ficaram em branco.

### Etapa 2 — Person `origin_id` no PipeRun

1. Em `_shared/piperun-hierarchy.ts → createPerson()`, aceitar `originId?: number` como parâmetro e incluir no `personPayload` quando presente.
2. Em `_shared/piperun-hierarchy.ts → updatePersonFields()`, mesma coisa para enriquecer Persons antigas.
3. No `smart-ops-lia-assign/index.ts` (chamadas a `createPerson`/`updatePersonFields`), passar o `originId` que **já é resolvido** para o Deal (mesma origem da primeira conversão). Mantém o princípio "origem da Pessoa = primeira conversão", consistente com a memória `Person vs Deal Origin Separation`.
4. Backfill opcional: estender `smart-ops-backfill-person-origin` para também escrever `origin_id` na Person no PipeRun (hoje só escreve em `lia_attendances.origem_primeiro_contato` local).

### Etapa 3 — Detecção de "nome da pessoa = nome da empresa"

1. Criar helper `isCompanyLikeName(nome)` em `supabase/functions/_shared/identity-utils.ts` que retorna `true` quando o nome bate com padrões de razão social: contém `clinica|clínica|consultório|consultorio|odonto|estética|estetica|dental|smile|ltda|me\b|eireli|s\.?a\.?|center|institut`, ou é totalmente em CAIXA ALTA com 2+ tokens, ou matcheia o `empresa_razao_social`/`empresa_nome` que veio no payload.
2. No `lia-assign`, antes de criar a Person:
   - Se `isCompanyLikeName(nome) === true`, **não** usar esse nome como `Person.name`. Em vez disso:
     - Criar a Company com esse nome ("ESTÉTICA AVANÇADA").
     - Criar a Person com `name = "Contato — ESTÉTICA AVANÇADA"` (placeholder claro) e marcar o lead com `crm_review_required = true` + `crm_review_reason = 'person_name_is_company'`.
     - Adicionar nota no Deal via `addDealNote`: *"⚠️ Nome do contato no formulário veio como razão social — confirmar nome real da pessoa no primeiro atendimento."*
3. Atualizar a memória `mem://smart-ops/person-centric-assignment-hierarchy-v6` com a nova regra de detecção.

### Etapa 4 — Validação

1. Rodar `smart-ops-piperun-retry-failed-leads` com `lead_ids=[3 leads afetados]` e confirmar que o UPDATE local passa.
2. Verificar no PipeRun que as Persons recém-criadas passam a mostrar Origem preenchida.
3. Confirmar que novos leads Meta com nome em formato razão social entram com flag `crm_review_required=true` e geram nota no Deal.

---

### Notas técnicas

- **NÃO** tocar em triggers (`fn_set_real_status`, `fn_recalc_ltv_from_deals`, etc.). O 42703 não vem deles — todos foram auditados.
- O webhook Meta continua escrevendo `pessoa_piperun_id` mesmo quando o UPDATE final do lia-assign falha (foi como o 41fccffd ficou com pessoa_piperun_id apesar do erro). Isso explica a incoerência aparente entre log e DB.
- `findPersonByEmail` está com `phone fallback disabled` (correto, já documentado em `mem://integration/piperun/merge-collision-prevention-logic`) — não precisa mudar.

Posso seguir com a implementação?
