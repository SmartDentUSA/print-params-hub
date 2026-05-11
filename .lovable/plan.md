## Causa-raiz (confirmada com a Camila Rolim)

A pessoa PipeRun **46852004** referenciada no nosso lead `7e700a6e-…` (Camila Rolim, `camilaleiterolim@hotmail.com`) está com:

- `name = "Heitor Rabeti"`
- `company.name = "Heitor Rabeti | Cirurgião-dentista CROSP 151018"`
- `hash = d2aikagf3p4wk8w840c8gw0k4ksgwss` (mesmo hash que salvamos no nosso DB)

Não é problema só da Camila — outros 3 leads recentes do `meta_lead_ads` aparecem no nosso DB com `nome="Heitor Rabeti"` mas email/telefone de outras pessoas (alexsandrosakurai@gmail.com, vjspada@gmail.com, elsierodrigues@hotmail.com). E na PipeRun existem múltiplas pessoas "Heitor Rabeti" criadas em sequência (46850765, 46851133, 46852004…).

### Bug #1 — `findPersonByEmail` em `smart-ops-lia-assign/index.ts` (linha 55)

```ts
const match = items.find((p) => { … e.email === lower … }) || items[0];
```

O endpoint `/persons` do PipeRun **ignora** o filtro `emails[email]` e devolve uma lista genérica (a primeira pessoa da conta). Quando o `find` por email falha (porque ninguém tem aquele email cadastrado), o `|| items[0]` retorna a **primeira pessoa qualquer** — no caso, "Heitor Rabeti". A versão em `_shared/piperun-hierarchy.ts` já corrigiu isso e tem comentário explícito alertando ("never do that"), mas a cópia em `lia-assign` ficou para trás.

Resultado: o deal da Camila foi vinculado à pessoa do Heitor Rabeti.

### Bug #2 — `mapDealToAttendance` sobrescreve `nome` cegamente (`piperun-field-map.ts:632`)

`nome = cleanPersonName(person?.name) || cleanDealName(deal.title)`. Quando o deal recém-criado é re-sincronizado (webhook ou full-sync), nosso `lia_attendances.nome` da Camila vira "Heitor Rabeti" — porque a Person attachada está errada. É exatamente o que aconteceu com 3 dos 4 leads (a Camila ainda não rodou um sync de retorno, por isso nome local ainda está certo).

### Bug #3 — Múltiplas pessoas duplicadas "Heitor Rabeti" no PipeRun

Como `findPersonByEmail` falhou por email, caiu no `createPerson` para Camila — mas com `lead.nome` sendo "Heitor Rabeti" também. Isso indica que para esses 4 leads, no momento do `lia-assign` o `nome` na DB já estava como "Heitor Rabeti". Provável combinação: leads ingeridos via `meta_lead_ads`, `raw_payload` nulo (sinal de que algum sync apagou), e nome poluído por sync de PipeRun anterior em loop. Conferir com auditoria.

## Plano de correção

### Parte A — Corrigir `findPersonByEmail` (lia-assign)
- Remover o fallback `|| items[0]` (linha 55).
- Adicionar lookup secundário por **telefone normalizado** (`/persons?search=<phone>`), também com strict-match dentro do array (`phones[].phone` igual ao normalizado).
- Centralizar usando a versão de `_shared/piperun-hierarchy.ts` (matar a duplicada de `lia-assign`).

### Parte B — Proteger `mapDealToAttendance` contra contaminação
Em `_shared/piperun-field-map.ts`:
- Não sobrescrever `nome`/`email`/`telefone_*` quando o `person.hash` retornado **diferir** do `pessoa_hash` que já temos persistido para o lead, **ou** quando o `email` do lead local não bater com `person.emails`. Nesse caso:
  - logar `system_health_logs` com `error_type='piperun_person_mismatch'`
  - manter os campos locais
  - flag em `raw_payload.piperun_person_mismatch = { local_email, remote_person_id, remote_name, at }` para auditoria
- Manter sobrescrita apenas quando há concordância de identidade (hash igual ou email confere).

### Parte C — Reparar leads afetados (one-shot, idempotente)
Edge function `smart-ops-piperun-detach-wrong-person` (nova) que:
1. SELECT em `lia_attendances` onde `merged_into IS NULL` e (`nome ILIKE '%heitor%rabeti%'` AND `email NOT ILIKE '%heitor%'` AND `email NOT ILIKE '%rabet%'`) — escopo inicial conhecido. Configurável.
2. Para cada um:
   - Restaurar `nome` via cascata: `raw_payload->latest_payload->>full_name` → `raw_payload.form_submissions[0]` → derivar do email.
   - No PipeRun: `POST /persons` com nome/email/phone corretos → obter novo `person_id`.
   - `PUT /deals/{piperun_id}` com `person_id` novo (e `company_id=null` para descolar da empresa do Heitor).
   - Atualizar `lia_attendances`: `nome`, `pessoa_piperun_id`, `pessoa_hash`.
   - Log em `lead_activity_log` com `event_type='piperun_person_detached'`.
3. Suporta `dry_run=true` (default) para listar antes de aplicar.

### Parte D — Auditoria geral (read-only)
Query de saúde para o Copilot detectar futuras ocorrências:
- Leads canonical com `pessoa_hash` compartilhado entre ≥2 leads de emails diferentes → flag.
- Leads cujo `nome` é prefixo do `nome` de outro lead canonical com `pessoa_piperun_id` distinto → flag.

### Parte E — Validação
1. Conferir Camila: `/persons` no PipeRun retorna pessoa nova (≠46852004) com nome "Camila Rolim" e o deal 59691554 apontando para ela.
2. Conferir alexsandrosakurai/vjspada/elsierodrigues: cada um com sua própria pessoa.
3. Repetir um sync `piperun-full-sync` e garantir que `nome` local não regride para "Heitor Rabeti" (Bug #2 corrigido).

## Arquivos alterados

- `supabase/functions/smart-ops-lia-assign/index.ts` — substituir `findPersonByEmail` local pela versão segura de `_shared/piperun-hierarchy.ts`; adicionar lookup por telefone.
- `supabase/functions/_shared/piperun-field-map.ts` — guarda em `mapDealToAttendance` contra `person_hash` divergente.
- `supabase/functions/smart-ops-piperun-detach-wrong-person/index.ts` — novo endpoint de reparo idempotente.
- (sem migrations; só código)

## Perguntas antes de implementar

1. Reparo: rodo Parte C com `dry_run=true` para você revisar os leads identificados (incluindo Camila + 3 outros conhecidos), e só executo o detach/recreate após você aprovar a lista? Ou já libero direto?
2. O escopo inicial do reparo deve ir além desses 4? Posso ampliar para "todos os leads canonical cuja pessoa_piperun_id é compartilhada com ≥1 outro canonical de email/telefone diferente", o que pega o resto dos casos contaminados.
