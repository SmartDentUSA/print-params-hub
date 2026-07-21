# Ativar lookup local via `piperun_persons_mirror`

O espelho já está populado (53.235 pessoas / 15.614 empresas). Agora precisamos ligá-lo ao fluxo de resolução de Person, sem alterar o funil de vendas.

## Escopo

**Somente** `supabase/functions/_shared/piperun-person-resolver.ts`. Nenhum outro consumidor muda porque `smart-ops-lia-assign`, `piperun-person-contact-backfill` e `_shared/piperun-hierarchy.ts` já chamam `findPersonByContact` deste módulo.

## O que muda

### 1. Novo helper: `findPersonInMirror(supabase, email, phone)`
Lookup local em ordem de confiança:
1. `email_normalized = lower(trim(email))` — hit → retorna `{id, company_id, matched_via:'mirror_email'}`.
2. `phone_digits = full digits` (>= 11) — hit → `mirror_phone_full`.
3. `phone_last10 = last 10 digits` (>= 10) — hit → `mirror_phone_last10`.

Cada hit lê `piperun_person_id` + `piperun_company_id` do mirror. Nada de escrever no PipeRun.

### 2. `findPersonByContact` passa a ser mirror-first
Injetamos `supabase?: SupabaseClient` como parâmetro opcional. Fluxo:
1. Se `supabase` foi passado → tenta `findPersonInMirror`. Hit → retorna imediatamente.
2. Caso contrário, cai no cascade atual (emails[email] → search email → phones[phone] → search phone).

Assim, chamadas antigas sem `supabase` continuam funcionando exatamente como hoje (compat retroativa 100%).

### 3. Callers passam `supabase`
- `smart-ops-lia-assign/index.ts` — as duas invocações de `findPersonByContact` já têm cliente Supabase no escopo; injetamos como argumento final.
- `_shared/piperun-hierarchy.ts` — mesma injeção onde já existe `supabase` no closure.
- `piperun-person-contact-backfill` — não chama `findPersonByContact` diretamente, só `verifyAndRecoverPersonContact` (que segue chamando a API, ok — é remediação pós-fato).

### 4. Instrumentação (leve)
Cada hit local grava um log `system_health_logs` com `error_type='piperun_mirror_hit'` (severity `info`) contendo `{matched_via, person_id, company_id}`. Serve pra medir a taxa de acerto do mirror nos primeiros dias.

## O que NÃO muda

- `verifyAndRecoverPersonContact` continua batendo API PipeRun (é pós-PUT, precisa da verdade remota).
- `validateCachedPerson` continua na API — a validação de existência precisa ser autoritativa.
- Golden Rule, CommercialIntentGuard, VENDAS immutability: intocados.
- Funil, stages, pipelines, owners, sorteio de vendedor: idênticos.
- Nenhuma migration nova, nenhum schema change.

## Riscos e mitigação

- **Mirror desatualizado**: se um Person novo foi criado no PipeRun após a importação e ainda não caiu no mirror, o lookup local vai falhar e cair automaticamente no fallback API. Zero regressão.
- **Falso positivo por telefone last10**: mesmo risco que a API tem hoje (`endsWith` já é usado). Precedência: email > phone_full > phone_last10 mitiga.
- **Sync futuro**: fora do escopo desta task. Fica marcado para próxima iteração (webhook PipeRun → upsert no mirror).

## Entregável

1. Patch em `_shared/piperun-person-resolver.ts` (adiciona helper + parâmetro opcional).
2. Duas linhas alteradas em `smart-ops-lia-assign/index.ts` (passar `supabase` nas chamadas).
3. Uma linha alterada em `_shared/piperun-hierarchy.ts`.
4. Log `piperun_mirror_hit` para observabilidade.

Total estimado: ~60 linhas de código, uma edge function reimplantada.