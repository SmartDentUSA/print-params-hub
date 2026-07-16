## Objetivo

Normalizar retroativamente os telefones já gravados em `lia_attendances` que ficaram malformados pela versão antiga do `normalizeBrazilianPhone` (DDDs inexistentes tratados como BR, mobile 10-dígitos sem o 9, etc.), **sem alterar nada no PipeRun** (nem Funil de Vendas, nem CS Onboarding, nem qualquer outro funil) e sem disparar automações.

## Escopo detectado no banco

Sobre `lia_attendances` (canônicos, `merged_into IS NULL`, `telefone_normalized` não nulo — 30.067 registros):

- **95** registros: prefixo `55`, DDD BR válido, 12 dígitos e 5º dígito ∈ {6,7,8,9} → **celular sem o 9** (ex.: `+553898475101` → `+5538998475101`).
- **69** registros: prefixo `55` mas DDD inexistente na ANATEL (ex.: 59, 20, 30, 50, 56, 57) → **internacional disfarçado de BR** (deve virar `+<digitos_originais>` sem `55` forçado).
- **134** registros com length ≠ 12/13 → casos anômalos (curtos/longos) que serão apenas listados, não alterados nesta rodada.
- Fixos BR de 12 dígitos legítimos (DDD válido, 5º dígito 2-5) permanecem como estão.

## Plano de execução

### 1. Script Deno de backfill (uso único, executado localmente / não é edge function persistente)

Criar `scripts/backfill-phone-normalize.ts`:

- Lê `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do ambiente.
- Importa `normalizeBrazilianPhone` de `supabase/functions/_shared/phone-normalize.ts` (versão já corrigida com whitelist de DDDs).
- Faz `SELECT id, telefone_normalized, telefone` em `lia_attendances` **em páginas de 500**, filtrando:
  - `merged_into IS NULL`
  - `telefone_normalized IS NOT NULL`
- Para cada linha:
  - Reprocessa `telefone_normalized` (e, se disponível, `telefone` bruto) pelo normalizador atual.
  - Só marca para update se o resultado **for diferente e não vazio**.
- Modo **dry-run por padrão** (imprime CSV: id, antes, depois, motivo). Só grava com `--apply`.

### 2. Campos que serão atualizados (apenas locais, nunca CRM)

Somente em `lia_attendances`:

- `telefone_normalized` → novo valor canônico.
- `phone_normalized_backfilled_at = now()` (novo campo booleano/timestamp para rastrear — ver passo 4).

**Não** serão tocados: `piperun_id`, `pessoa_piperun_id`, `proprietario_lead_crm`, `funil_*`, `stage_*`, `real_status`, `sellflux_*`, nem qualquer campo que dispare webhook. Nenhuma chamada a PipeRun, Sellflux, Evolution ou automações. Nenhum insert em `agent_actions_log` que gere reprocessamento.

### 3. Guarda anti-CRM (paranoia extra)

Apesar de o backfill não chamar PipeRun, o script vai:

- **Pular** qualquer lead cujo `real_status` esteja em (`CLIENTE_ativo`, `perdida_renutrir`, `em_negociacao`, `qualificado`, `novo`) e que tenha `pessoa_piperun_id IS NOT NULL` — na verdade, o script **não chama nenhum endpoint externo em nenhuma hipótese**, então esse filtro é só documentação; o update é 100% local em `lia_attendances`.
- Também evita triggers: rodar `SET session_replication_role = replica;` na conexão antes do UPDATE, `RESET` no fim, para garantir que triggers de sync CRM/Sellflux não disparem. (Se algum trigger for essencial para integridade, uso `UPDATE ... SET telefone_normalized = ... WHERE id = ...` simples e confio que não há trigger que empurre para o PipeRun — a validar lendo `pg_trigger` de `lia_attendances` antes de aplicar.)

### 4. Migração pequena de suporte

Adicionar coluna `phone_normalized_backfilled_at TIMESTAMPTZ NULL` em `lia_attendances` para idempotência (não reexecutar em registros já corrigidos). Sem RLS/policy nova, sem grants adicionais (a tabela já é acessada por service role).

### 5. Ordem de rollout

1. Aplicar migração da coluna auxiliar.
2. Rodar `deno run --allow-net --allow-env scripts/backfill-phone-normalize.ts` em **dry-run** e salvar CSV em `/mnt/documents/phone-backfill-preview.csv` para eu inspecionar amostras (celulares sem 9, DDDs inválidos, etc.).
3. Após conferência, rodar com `--apply` em lotes de 500, com log final em `system_health_logs` (`event_type = 'phone_backfill'`, contagens agregadas — sem PII).
4. Reconsultar as três contagens (mobile_missing_9, invalid_ddd_br, abnormal_len) para validar impacto.

## O que **não** será feito

- Nenhum PATCH/POST no PipeRun (deals do Funil de Vendas e CS Onboarding ficam intactos, mesmo com telefone corrigido no CDP).
- Nenhum reenvio para Sellflux/Evolution/Meta.
- Nenhum merge de leads baseado no novo telefone (isso é outra história e ficará para plano separado, se pedido).
- Nenhuma mudança na função `_shared/phone-normalize.ts` (já corrigida na rodada anterior).

## Detalhes técnicos

```text
Impacto estimado (dry-run será verdade absoluta):
  ~95  celulares BR ganham o 9
  ~69  “BR fake” viram internacionais (+598…, +54…, +57…)
  ~134 comprimentos atípicos → só listados, não alterados
Zero writes em tabelas que disparam CRM/Sellflux.
```

Confirmando: aplicar migração da coluna + rodar dry-run primeiro, e só depois `--apply`?
