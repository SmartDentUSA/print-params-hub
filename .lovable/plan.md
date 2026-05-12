## Diagnóstico — Wendril Dias (`97814f87…`)

Sequência real (3 retries em 30 min):

```
21:26 → person_resolution_trace: had_cached_pessoa_piperun_id=false → createPerson 46909081
       → updatePersonFields → piperun_email_silently_rejected (missing_email + missing_phone)
       → deal_creation_blocked_empty_person → lead.pessoa_piperun_id NÃO foi salvo
21:30 → idem → cria outro Person 46909176 (lixo)
22:00 → idem → cria Person 46910743 (lixo)
```

Dois bugs reais:

1. **Person ID vazado:** quando o guard "empty_person" bloqueia o Deal, `lia-assign` retorna sem persistir `pessoa_piperun_id` na `lia_attendances`. No retry seguinte `had_cached_pessoa_piperun_id=false`, então `findPersonByContact` é chamado, não acha (porque os Persons anteriores ficaram vazios e `findPersonByContact` filtra por email/phone existentes), e `createPerson` é chamado de novo → cria mais um Person fantasma. Geramos 3 Persons lixo para o mesmo lead.

2. **Silent reject sem dono identificável:** PipeRun rejeita `wendril.dias16@gmail.com` e `+5563999810891` no PUT (200 OK mas o card fica vazio). `findPersonByContact` reverso não encontra outro Person dono — provavelmente porque o dono real é um Person criado pela integração nativa Meta↔PipeRun com o email/phone armazenado em campo "raw" que não responde aos filtros `emails[email]`/`phones[phone]`, mas ainda assim conta como conflito no PUT.

## Correção (escolhida: "Resolver por busca + descartar cache vazio")

### 1. `_shared/piperun-person-resolver.ts` — busca expandida

Adicionar `findPersonExpanded(apiToken, { email, phone, name })`:

- a) `findPersonByContact` (atual: 4 estratégias).
- b) Se ainda nulo, `GET /persons?search=<nome>&show=50` e retornar matches que tenham OU email igual OU phone digits igual OU mesmo `name` exato (case-insensitive). Loga `matched_via=name_search_with_contact`.
- c) Se ainda nulo, `GET /persons?search=<email-localpart>` (antes do `@`) e mesma validação.

Esse passo encontra o "Person fantasma" criado pela integração nativa Meta quando o filtro estrito não pega.

### 2. `lia-assign` — descartar Person empty antes de criar Deal

No bloco "Step 5a" (linhas 1897-1927):

- Quando `personId` (cached ou recém-encontrado) passar por `validateCachedPerson` e `hasContact === false`, chamar `findPersonExpanded` para procurar o dono real do email/phone/name.
  - Se achar outro Person com contato → adotar esse ID, descartar o vazio, logar `error_type=piperun_person_swapped_empty_to_owner`.
  - Se não achar nenhum outro → **manter** o personId vazio e prosseguir (o `verifyAndRecover` já tenta popular; se falhar, o guard bloqueia o Deal **mas** persiste o ID — ver passo 3).

### 3. Persistir `pessoa_piperun_id` SEMPRE (mesmo bloqueado)

No `lia-assign`, antes do `return` que sinaliza `blocked_empty_person` (linhas ~2080-2095):

```ts
await supabase.from("lia_attendances")
  .update({
    pessoa_piperun_id: personId,
    crm_creation_blocked: true,
    crm_creation_blocked_reason: "empty_person_in_piperun",
  })
  .eq("id", lead.id);
```

Assim, próximos retries reaproveitam o mesmo Person ID em vez de criar lixo. O `validateCachedPerson` no próximo retry vai detectar `hasContact=false` e o passo 2 vai tentar swap para o dono real.

### 4. Limpeza retroativa (one-shot job)

Criar uma função `piperun-person-empty-sweeper` (ou um SQL helper) que:

- Para cada lead com `crm_creation_blocked='empty_person_in_piperun'`:
  - Roda `findPersonExpanded`. Se achar dono → atualiza `pessoa_piperun_id`, limpa o block, re-enfileira no `lia-assign`.
  - Se não achar → marca `raw_payload.empty_person_unresolvable=true` para inspeção manual (não tenta de novo).

### 5. Logging adicional

Em todo `createPerson` invocado pelo `lia-assign`, logar `system_health_logs error_type=piperun_person_created_path` com `{ via: "fallback_after_findPerson_null", existing_cached_id, ... }`. Isso permite contar quantos Persons "lixo" são criados por dia e validar a correção.

### 6. Validação pós-deploy

- Re-disparar manualmente `lia-assign` para o lead Wendril (`97814f87…`).
- Verificar que `pessoa_piperun_id` é preenchido **sem** Deal criado (caso ainda fique vazio) ou **com** Deal (caso o dono real seja encontrado).
- SQL audit:
  ```sql
  SELECT count(*) FROM lia_attendances
  WHERE merged_into IS NULL AND crm_creation_blocked='empty_person_in_piperun';
  ```
  Esperado cair a zero após o sweeper.

### 7. Memória

Atualizar `mem://architecture/empty-person-piperun-guard.md`:

- Adicionar regra: "Quando o guard bloquear Deal, `pessoa_piperun_id` DEVE ser persistido para evitar criação de Persons fantasmas em retries."
- Documentar `findPersonExpanded` como o resolvedor canônico antes de chamar `createPerson` no `lia-assign`.

## Resultado esperado

- Lead Wendril e similares: `pessoa_piperun_id` preenchido no primeiro retry; sweeper resolve o conflito do PUT silencioso ou marca para inspeção manual.
- Zero Persons "lixo" criados por retry-cron.
- Cards do PipeRun deixam de proliferar com nomes duplicados sem contato.
