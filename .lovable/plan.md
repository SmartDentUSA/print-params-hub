## Diagnóstico — `wilimar.melo@hotmail.com`

Reconstrução cronológica do que aconteceu:

```text
10:33  Lead canônico já existia: wilimar.melo@gmail.com (id 02a0…, piperun_id 59451613, fone +5582999539063)
10:35  Submit form exocad I.A. com email wilimar.melo@hotmail.com + mesmo fone
       └─ ingest-lead procurou existente APENAS por email (.eq email)
       └─ Não achou → INSERIU novo lead 3279f3f7… (sem piperun_id)
       └─ Disparou lia-assign para lead_id=3279f3f7…
       depois  merge-system uniu por fone → 3279… ficou com merged_into=02a0…
11:00  Canonical 02a0… recebeu crm_deal_updated (deal 59451613)
```

**Problema real:** o `ingest-lead` só faz lookup por `email` (linha 104 de `smart-ops-ingest-lead/index.ts`). Quando o mesmo lead chega com email diferente mas mesmo telefone, ele **insere um novo registro** e dispara `lia-assign` para esse novo registro órfão. O merge corrige depois, mas:

1. O `lia-assign` recebe `lead_id` do não-canônico — ele **não checa `merged_into`** e tentaria criar/operar deal nesse lead órfão (no caso do Wilimar, o merge ocorreu antes do lia-assign tocar PipeRun, por isso o deal canônico foi atualizado — mas isso é coincidência de timing).
2. O `form_data` rico (respostas do exocad I.A.) entrou no lead órfão — quando o merge copia para o canônico depende de `lead-merge-system-v2` rodar a tempo.
3. Não há nota explícita no deal 59451613 marcando "Nova submissão exocad I.A. recebida via hotmail".

## Plano de correção

### 1. `smart-ops-ingest-lead/index.ts` — lookup multi-identidade + canonização

Substituir o lookup único por email pela cascata de identidade do CDP (alinhado a `mem://identity & merging`):

```ts
// 1) Por email
let existingLead = await fetchByEmail(email);
// 2) Por telefone normalizado, se não achou
if (!existingLead && telefoneNormalized) {
  existingLead = await fetchByPhone(telefoneNormalized);
}
// 3) Se o achado tem merged_into, seguir cadeia até o canônico
while (existingLead?.merged_into) {
  existingLead = await fetchById(existingLead.merged_into);
}
```

Comportamento depois disso:
- Se `existingLead` existe → roda `mergeSmartLead` no **canônico** (não cria órfão).
- Se o email recebido é diferente do canônico → adiciona ao `raw_payload.alternate_emails` (sem sobrescrever `email` canônico) e mantém `form_data[formName]` com `submitted_via_email: <hotmail>`.
- `lia-assign` é disparado com `lead_id` = canônico.

### 2. `smart-ops-lia-assign/index.ts` — guard de canonização

No início (após buscar o lead, ~linha 1233), adicionar:

```ts
// Follow merged_into chain to canonical
let canonical = lead;
while (canonical.merged_into) {
  const { data } = await supabase.from("lia_attendances")
    .select("*").eq("id", canonical.merged_into).maybeSingle();
  if (!data) break;
  canonical = data;
}
const lead = canonical; // operar sempre no canônico
```

Isso protege contra qualquer caller que ainda passe um `lead_id` órfão.

### 3. Nota no deal documentando a nova submissão

Quando o `ingest-lead` faz merge em canônico que já tem `piperun_id`, disparar `smart-ops-deal-form-note` (já existe) com:
- nome do formulário (`# - Formulário exocad I.A.`)
- email alternativo usado (`wilimar.melo@hotmail.com`)
- campos novos preenchidos
- timestamp

Assim o vendedor enxerga no PipeRun que houve uma nova interação, mesmo sem mover o deal.

### 4. Reprocessar o caso Wilimar manualmente

Após deploy:
- Disparar `smart-ops-lia-assign` com `lead_id = 02a0ea74…` e `force=true` para garantir que o deal 59451613 está enriquecido com os dados do form exocad I.A.
- Postar nota retroativa no deal com a submissão de 10:35.

### 5. Memória

Atualizar `mem://smart-ops/lead-merge-system-v2` adicionando regra: "ingest-lead deve resolver canônico ANTES de inserir, usando cascata email → telefone → merged_into".

## Arquivos afetados

- `supabase/functions/smart-ops-ingest-lead/index.ts` (lookup + post-merge note trigger)
- `supabase/functions/smart-ops-lia-assign/index.ts` (canonical guard)
- `mem://smart-ops/lead-merge-system-v2` (nova regra)
- Script one-shot para reprocessar `02a0ea74…`

## Não muda

- Lógica de `mergeSmartLead`, `lead-merge-system-v2`, `piperun-hierarchy.ts`, `crm-sync-concurrency-lock`.
- Estrutura do schema (sem migrations).
- Webhooks Sellflux / cognitive-analysis.

Posso prosseguir?