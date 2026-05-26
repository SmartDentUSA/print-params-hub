## Diagnóstico

Lead `Thiago` (subscriber `555774135`, id `5dfe6434-…`) criado em 25/05 21:50 pelo Instagram/ManyChat:

- Capturou `telefone_normalized=+5516997322333`, área, especialidade e produto.
- **NÃO** foi mesclado com os dois leads canônicos existentes que têm o mesmo telefone (`154d5b9b…` e `f611bce3…`, ambos com `piperun_id` real).
- **NÃO** entrou no funil de vendas: `piperun_id`, `pessoa_piperun_id`, `proprietario_lead_crm` ficaram NULL.

Evidências em `system_health_logs` (function `manychat-lia-bridge`):

```
21:50:28 manychat_ask_email
21:50:39 manychat_email_update_conflict  -> "lia_attendances_email_ci_key"
21:50:40 manychat_ask_phone
21:51:01 manychat_product_captured
21:51:08 manychat_ask_area
21:51:18 manychat_ask_specialty
21:51:33 manychat_specialty_captured
21:51:35 manychat_handoff_error   -> "Edge Function returned a non-2xx status code"
```

Nenhum log `manychat_merged_into_canonical` foi registrado. Padrão se repete em outros subscribers (`888640279`, `1829101618`, etc.) — todos terminam em `manychat_handoff_error` ou ficam sem handoff.

### Causas

1. **Handoff envia e-mail sintético `mc_<id>@instagram.lead`** para `smart-ops-ingest-lead`. Como já existe `lia_attendances` com esse mesmo e-mail (o próprio lead criado pelo bridge), o `insert` interno do ingest dispara `lia_attendances_email_ci_key` → 500 → handoff falha → nada chega ao PipeRun. Quando o usuário fornece um e-mail real, o bridge captura conflito (`manychat_email_update_conflict`) mas **mantém o sintético** no payload de handoff, então o problema persiste.
2. **Merge canônico por telefone não fundiu** o duplicata ManyChat com os Thiago canônicos. Os candidatos existem (mesmo `telefone_normalized`, `merged_into IS NULL`), porém o ramo `nextMissing === "phone"` só executa quando `entities.awaiting_manychat_phone === true`. No turno em que o telefone foi capturado, a sessão estava em outro estado (após o `manychat_email_update_conflict`, o bridge re-perguntou e-mail antes de marcar `awaiting_manychat_phone`), então o bloco de merge por telefone foi pulado.
3. **`crm_creation_blocked=true` permanece** mesmo depois de ter identidade real (telefone) — bloqueia qualquer reprocessamento posterior por `smart-ops-lia-assign`.
4. **`lia_attendance_id` é enviado no payload de handoff** mas o `smart-ops-ingest-lead` continua usando `email` como chave primária de busca/insert — ignora o `lia_attendance_id` quando o e-mail é sintético.

## Plano de correção

### 1. `supabase/functions/manychat-lia-bridge/index.ts`

- **Antes do handoff**, executar `mergeIntoCanonical` **incondicionalmente** se houver `telefone_normalized` no lead ManyChat e existir outro lead canônico (`merged_into IS NULL`) com o mesmo telefone — independente de `awaiting_manychat_phone`. Mesma checagem para e-mail real (não sintético).
- **No payload de handoff** (`ingestPayload`):
  - Se `emailAtual.endsWith("@instagram.lead")` ou `@manychat.internal`, enviar `email: null` (deixar ingest descobrir pela identidade do `lia_attendance_id`/telefone).
  - Sempre enviar `lia_attendance_id` apontando para o canônico final (pós-merge), nunca para a duplicata.
- **Limpar `crm_creation_blocked`** no lead canônico quando: telefone real + nome real + área já capturados (mesmo sem e-mail real). É o suficiente para criar Person no PipeRun (telefone basta como identifier — ver `mem://architecture/empty-person-piperun-guard`).

### 2. `supabase/functions/smart-ops-ingest-lead/index.ts`

- Aceitar `lia_attendance_id` no payload como **chave primária de identidade** quando presente e o e-mail recebido for sintético (`@instagram.lead`, `@manychat.internal`). Nesse caso:
  - Pular a checagem `if (!email) → 400`.
  - Pular o insert de novo lead; carregar o lead pelo `lia_attendance_id` e seguir o caminho de “lead existente” (PipeRun creation, owner assignment).
- Validar que `crm_creation_blocked=false` antes de invocar `smart-ops-lia-assign`.

### 3. Backfill manual (migration)

- Mesclar `5dfe6434-…` em `f611bce3-2bc8-49bd-a6f5-976eb91075a3` (canônico Thiago mais recente com `piperun_id=59749742`). Smart Merge append-only nos campos `area_atuacao`, `especialidade`, `manychat_subscriber_id`, `instagram`, `produto_interesse_auto`. Setar `merged_into` e zerar `manychat_subscriber_id` no duplicata.
- Identificar e mesclar os outros leads órfãos ManyChat dos últimos 7 dias com `telefone_normalized` que casa com canônicos pré-existentes (query será incluída na migration).
- Para leads ManyChat sem canônico equivalente mas com telefone real (ex.: subscriber `888640279`), limpar `crm_creation_blocked=false` e enfileirar para `smart-ops-lia-assign`.

### 4. Memória

- Atualizar `mem://integration/manychat-canonical-merge.md` adicionando regra: merge canônico por telefone deve rodar **na criação/atualização do lead ManyChat**, não apenas no ramo de coleta de campo.

## Validação

1. Após edit + migration, simular novo evento ManyChat com telefone de lead existente → verificar:
   - Lead duplicata recebe `merged_into = canonical.id`.
   - Canonical recebe `manychat_subscriber_id`.
   - Handoff chama `smart-ops-ingest-lead` com `lia_attendance_id=canonical`.
   - PipeRun Person/Deal são criados/atualizados no canônico.
2. Conferir `system_health_logs` para 0 `manychat_handoff_error` em 1h.
3. Validar o backfill de Thiago: card de lead `f611bce3` deve mostrar `manychat_subscriber_id=555774135` e histórico do Instagram.

## O que não muda

- Lógica do flow de qualificação (perguntas área/especialidade) permanece igual.
- Bridge continua criando leads sintéticos quando subscriber é novo e sem identifier real — apenas o **handoff** e o **merge** mudam.
- Funções `lia-assign` e Golden Rule não são tocadas.
