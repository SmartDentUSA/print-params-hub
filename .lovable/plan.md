## Correção da hipótese anterior

Você está certo: **não existe integração nativa Meta→PipeRun** neste projeto. Todos os leads Meta entram via `smart-ops-meta-lead-webhook` → `smart-ops-ingest-lead` → `smart-ops-lia-assign`. Os três formulários abaixo passam pelo MESMO código:

| Formulário | Total 14d | Pessoa OK | Deal OK |
|---|---|---|---|
| BLZ- Smart Dent | 116 | 116 | 116 |
| # - FACE - INTRAORAL MEDIT | 102 | 102 | 102 |
| # - FACE - SCAN BANCADA MEDIT | 72 | 72 | 72 |
| # - Impressoras - Smart Dent | 49 | 49 | 49 |
| # - Impresoras - Smart Dent (typo) | 44 | 44 | 44 |

**100% de cobertura** em todos. Logo o "form Impressoras não preenche" não é regra — é exceção. Gabrielly é caso isolado, não padrão.

## O que de fato aconteceu com a Gabrielly

Linha do tempo (de `system_health_logs`):

```
11/05 11:31  error_no_person  owner=Evandro Silva
11/05 12:53  error_no_person  owner=Janaína Santos
11/05 12:56  error_no_person  owner=Marcela Brito
11/05 13:27  error_no_person  owner=Adriano Oliveira
11/05 13:27  error_no_person  owner=Adriano Oliveira (2x)
11/05 14:17  error_no_person  owner=Patrícia Silva
12/05 13:48  piperun_person_contact_backfilled status=200  ← backfill manual de ontem
```

Em **todas as 6 tentativas** o lia-assign saiu pelo branch `error_no_person` (linha 1972 de `smart-ops-lia-assign/index.ts`) — `personId` ficou `null`. Mas:
- Não há `piperun_create_person_api_error` (que `createPerson` registraria após 3 tentativas falhas).
- Não há `raw_payload.piperun_last_error` no lead.
- Não há `person_create_blocked_missing_identifiers`.

Conclusão: `createPerson` **não foi executado** ou levantou exceção engolida pelo try/catch externo. O `personId` chegou a `null` por outro caminho (provavelmente `findPersonByEmail` retornando uma Pessoa cacheada inválida que foi invalidada e o re-create silenciosamente abortou — branch sem log).

Apesar disso, o Deal `59696103` e a Pessoa `46857102` existem no PipeRun. Foram criados em algum momento entre 11/05 14:17 e 12/05 13:48, seja por:
- Re-execução do lia-assign que **passou** (mas sem gravar log de sucesso de contato), ou
- Reconciliação por outra função (`merge-collision-prevention`, `retry-cron`, ou criação manual no PipeRun).

Em qualquer cenário, o PUT `updatePersonFields` que republica `emails[]/phones[]` nunca rodou — por isso o card ficou em branco até o backfill manual de ontem 13:48.

## Causas-raiz (revisadas)

| # | Problema real | Correção |
|---|---|---|
| 1 | 6× `error_no_person` sem nenhum log do POST `/persons` → impossível depurar caminho do `personId=null` | Instrumentar `lia-assign`: log obrigatório imediatamente antes do `if (personId)` final, com `cached_id`, `findPersonByEmail_id`, `createPerson_called`, `createPerson_returned`. Em caso de `personId=null`, gravar `system_health_logs` com `error_type='person_resolution_trace'` e `details.checkpoints[]` |
| 2 | `createPerson` pode ter sido pulado quando lead já tinha `pessoa_piperun_id` cacheado e a validação por `findPersonByEmail` falhou | Garantir que o branch "stale cache" sempre chame `createPerson` se a Pessoa não existir mais, sem fallback silencioso |
| 3 | Quando lia-assign saiu em `error_no_person` mas a Pessoa foi criada/reconciliada depois por outro caminho, ninguém republicou contato | Safety-net no `smart-ops-retry-cron`: a cada execução, varrer leads onde `pessoa_piperun_id IS NOT NULL` e `merged_into IS NULL` mas que **nunca** geraram `piperun_person_contact_backfilled` ou `piperun_person_contact_published` → invocar `piperun-person-contact-backfill` em batch |
| 4 | Métricas inflam vendedor "atribuído" 6x para um lead que ele nunca viu | Mudança cosmética: em `error_no_person`, gravar `last_failed_assignment_owner` em vez de manter `proprietario_lead_crm` null sem rastro |

## Plano de implementação

1. **Instrumentação** — `smart-ops-lia-assign/index.ts`:
   - Antes de `if (personId)` (~linha 1818): log estruturado com checkpoints.
   - Em `error_no_person` (linha 1980-1993): adicionar `details.checkpoints` ao insert atual.

2. **Log de contato publicado** — `_shared/piperun-hierarchy.ts → updatePersonFields` e `smart-ops-lia-assign/index.ts → updatePersonFields`:
   - Após PUT bem-sucedido com `emails[]` ou `phones[]`, inserir em `system_health_logs` com `error_type='piperun_person_contact_published'`.

3. **Safety-net no retry-cron** — `smart-ops-retry-cron/index.ts`:
   - Nova etapa: SELECT em `lia_attendances` (`merged_into IS NULL`, `pessoa_piperun_id NOT NULL`, `created_at > now()-7d`) LEFT JOIN `system_health_logs` para `piperun_person_contact_published|backfilled` → invocar `piperun-person-contact-backfill` em batch de 50.

4. **Backfill histórico** — chamar `piperun-person-contact-backfill` com `{days:30, limit:200}` em loop até processar todos os leads `meta_lead_ads` desde 01/mai sem registro de contato publicado.

5. **Validação** — re-rodar lia-assign em modo `force=true` para o lead da Gabrielly (já corrigido) e em mais 5 leads do form Impressoras para confirmar que o trace nunca devolve `personId=null` silenciosamente.

## Arquivos a editar

- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/_shared/piperun-hierarchy.ts`
- `supabase/functions/smart-ops-retry-cron/index.ts`
- Migration: `lia_attendances.last_failed_assignment_owner TEXT NULL`
- `mem://integration/piperun-person-contact-enrichment.md` (atualizar com safety-net retry-cron)

## Fora de escopo

- Reescrever `createPerson` (já tem 3 tentativas + log diagnóstico)
- Mudar round-robin
- UI de auditoria de falhas

Aprovando, executo: instrumentação → deploy → reproduzir Gabrielly com `force=true` → safety-net + backfill.