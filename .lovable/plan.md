# Person card chega vazio no PipeRun (intermitente)

## Diagnóstico

Não é "às vezes envia certo, às vezes envia faltando" por bug nosso de payload — é **PipeRun aceitando o PUT (HTTP 200) e ignorando silenciosamente `emails[]`/`phones[]`** quando esses identificadores já estão atrelados a OUTRO Person.

**Evidências (últimas 24h):**
- 266 leads com `piperun_person_contact_published` (PUT 200 com `emails`/`phones` no payload)
- **127 leads** logo em seguida com `piperun_contact_still_missing_after_resync` (`GET /persons/{id}` retorna `emails_count:0, phones_count:0`)
- Caso Enielson Neves (`53788790-…`): primeira chamada `lia-assign` em 18:56 retornou 504/WORKER_ERROR (mas provavelmente criou Person no PipeRun). Retry em 19:30 fez `findPersonByEmail` retornar null → `createPerson` criou Person 46902881 NOVO → PUT 200 → GET mostra emails/phones vazios. Resultado: card "E-mail não informado / Telefone não informado".

**Causa raiz:**
1. `findPersonByEmail` só compara `emails[].email` exato no array retornado pelo `/persons?search=`. Não tenta busca por telefone, não tenta `?search=<phone>`, e ignora a possibilidade de o Person ter sido criado pela integração nativa Meta sem email indexado ainda.
2. Quando Person já existe com aquele email, PipeRun silenciosamente "limpa" o array no PUT (não retorna 422). Isso é confirmado por 127 casos hoje.
3. Confirmado também o palpite do usuário: "quando não encontra Person, cria com apenas nome" — acontece quando `emails`/`phones` enviados no POST batem com Person existente; PipeRun cria a casca só com `name`.

## O que vai mudar (3 arquivos)

### 1. `_shared/piperun-hierarchy.ts` + `smart-ops-lia-assign/index.ts:findPersonByEmail`

Cascata de busca antes de chamar `createPerson` (retorna primeiro hit válido):

```text
a) GET /persons?emails[email]=<email>           (já existe)
b) GET /persons?search=<email>                   (já existe)
c) GET /persons?phones[phone]=<phone_e164>       (NOVO)
d) GET /persons?search=<phone_digits>            (NOVO)
e) GET /persons?search=<phone_local_8_or_9_dig>  (NOVO — sem DDI/DDD para casar formato salvo)
```

Match estrito: comparar normalizando email (lowercase) e phone (apenas dígitos). Se qualquer hit casar, **reusar** esse `person_id` em vez de criar.

### 2. Verify-and-recover pós-PUT (no `lia-assign` E no `_shared`)

Hoje a etapa "verify" só LOGA quando `emails_count=0`. Vamos torná-la **ativa**:

1. `PUT /persons/{id}` com payload completo
2. `GET /persons/{id}` — extrair `emails[]`, `phones[]`
3. Se `emails[]` vazio E temos `lead.email`:
   - `GET /persons?emails[email]=<email>` — descobrir o ID que detém o email
   - Se for diferente do `personId` atual → marcar `personId` como duplicata: gravar em `lia_attendances.pessoa_piperun_id` o ID dono do email, gravar lead no novo Person via `updatePersonFields`, log `error_type='piperun_person_remapped_owner_of_email'`
   - Se ninguém detém o email → tentar PUT novamente só com `{emails:[{email}]}` em payload mínimo (3ª tentativa); se ainda falhar, log `error_type='piperun_email_silently_rejected'` com payload+resposta
4. Mesma lógica para `phones[]` vazio.

### 3. Backfill remediation: `piperun-person-contact-backfill`

Adicionar modo `mode:'remediate_silent_rejects'` que varre `system_health_logs` onde `error_type='piperun_contact_still_missing_after_resync'` nas últimas 72h e roda o verify-and-recover acima para cada um. Roda 1×/h via cron existente. Limite 200 por execução, throttle 250ms.

## Fora do escopo

- Não tocar em `createPerson` payload — já está correto.
- Não mexer nas regras de Deal / custom fields.
- Não mexer no debounce de 60s — continua válido para race conditions curtas.

## Validação

1. Reprocessar Enielson (`53788790-…`) e Su Fernandes (`b2f3511d-…`) com nova lógica → cards devem mostrar email + telefone.
2. Rodar `remediate_silent_rejects` para os 127 leads das últimas 24h.
3. Acompanhar `system_health_logs` por 24h: contagem de `piperun_contact_still_missing_after_resync` deve cair pra ~0; `piperun_person_remapped_owner_of_email` mostra quantos foram reatribuídos.

## Arquivos editados

- `supabase/functions/_shared/piperun-hierarchy.ts`
- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/piperun-person-contact-backfill/index.ts`
- `mem/integration/piperun-person-contact-enrichment.md` (documentar regra do silent reject)
