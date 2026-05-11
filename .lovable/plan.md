## Objetivo

Antes de reprocessar os 61 leads (retry) e ingerir os 324 do CSV (backfill), garantir que **nenhum Deal duplicado** seja criado no Piperun. Adicionar uma camada de verificação prévia (dry-run) que inspeciona o Piperun por e-mail e relata o que será feito, antes de qualquer escrita.

## Por que isso é seguro hoje (e onde pode falhar)

A `smart-ops-lia-assign` já tem dedupe robusto (Golden Rule) em `_shared/piperun-hierarchy.ts`:

```text
findPersonByEmail (agora com emails[email]=) →
  findPersonDeals →
    deal aberto em Vendas?  → updateExistingDeal (NÃO cria)
    deal aberto em Estagnados? → moveDealToVendas (NÃO cria)
    deal Ganho?              → preservar, NÃO tocar
    nenhum dos acima         → createNewDeal
```

Risco real de duplicação só existe se:
1. `findPersonByEmail` falhar em achar a pessoa (e cair em `createPerson` + `createNewDeal`).
2. O lead local já tiver um `piperun_id` antigo, mas o orquestrador também criar um novo Deal por não checar o ID local.
3. A pessoa no Piperun estiver cadastrada apenas por **telefone**, sem o e-mail do lead.

## Plano

### 1. Pré-auditoria (dry-run obrigatório, sem escrever no Piperun)

Criar `supabase/functions/smart-ops-piperun-preflight/index.ts`. Recebe `{ emails: string[] }` e, para cada e-mail, retorna:

```text
email | local_piperun_id | piperun_person_id | open_vendas_deal | open_estagn_deal | won_deals | action
```

Onde `action` ∈:
- `skip_local_id_present` — lead já tem `piperun_id` no banco
- `skip_open_deal_exists` — pessoa tem deal aberto (Vendas ou Estagnados) → será **enriquecido**, não duplicado
- `skip_won_only` — só tem deal ganho → não tocar
- `safe_create` — pessoa não existe ou existe sem deal aberto → criar novo Deal

Saída em JSON + CSV salvo em `/mnt/documents/piperun-preflight-{ts}.csv` para auditoria.

### 2. Reforço de guard-rails no fluxo principal

Em `smart-ops-lia-assign/index.ts`, antes de `createNewDeal` no caminho `new_deal`:

- Se `lead.piperun_id` já existir no banco, **não criar novo**: validar via `GET deals/{id}`. Se vivo e não-deletado, apenas atualizar; se morto, então criar.
- Se a pessoa foi achada por telefone mas não por e-mail, logar `[dedupe] person matched by phone only` para investigação.

### 3. Modos seguros nas funções de retry/backfill

- `smart-ops-piperun-retry-failed-leads`: aceitar `dry_run: true`. Em dry-run, chamar `smart-ops-piperun-preflight` para os e-mails do lote e retornar o relatório, sem invocar `lia-assign`.
- `smart-ops-meta-csv-backfill`: aceitar `dry_run: true` (já filtra por e-mails ausentes no banco). Em dry-run, também chamar o preflight para os 324 e-mails — mesmo que não estejam no banco local, podem já existir no Piperun via outro canal.

### 4. Execução faseada

```text
Fase A — preflight dos 61 leads (retry)         → revisar CSV
Fase B — preflight dos 324 leads (CSV backfill) → revisar CSV
Fase C — executar retry com force=true apenas nos `safe_create` + `skip_open_deal_exists`
Fase D — executar backfill apenas nos e-mails marcados `safe_create`
```

Nunca rodar Fase C/D antes da minha confirmação após revisar A/B.

## Arquivos afetados

- `supabase/functions/smart-ops-piperun-preflight/index.ts` (novo)
- `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` (adicionar `dry_run`)
- `supabase/functions/smart-ops-meta-csv-backfill/index.ts` (adicionar `dry_run` + chamada ao preflight)
- `supabase/functions/smart-ops-lia-assign/index.ts` (guard `lead.piperun_id` antes de `createNewDeal`)
- `supabase/config.toml` (registrar nova function)

## Validação

1. Rodar preflight nos 2 lotes, baixar CSV, conferir contagens de cada `action`.
2. Rodar Fase C/D apenas após aprovação.
3. Após execução: query em `lia_attendances` agrupando por `piperun_id` para confirmar zero duplicatas.
