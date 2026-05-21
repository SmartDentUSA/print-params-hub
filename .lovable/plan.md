# Investigação dos 9 leads "perdidos"

## Causa raiz identificada

Não houve `downstream_dispatch_non_ok` — esse warning não aparece nos logs atuais. O que está acontecendo é uma **colisão de identidade silenciosa** seguida de **dedupe agressivo por `leadgen_id`** no `smart-ops-ingest-lead`. Sequência:

1. Meta entrega um lead novo (ex.: `meta_leadgen_id=2266383444132962`, e-mail `maria.silva@yahoo.com`, telefone `+5521996332093`, nome "Maria Fatima Da Silva").
2. O `findOrCreate` da `lia_attendances` casa por **telefone + nome** com um lead anterior (`maria.silva317@yahoo.com`, lead `0ba4ff5c…`, `platform_lead_id=2171507266979350`).
3. O ingest grava em `lead_activity_log` um evento `meta_ads_lead_entry` com `entity_id = novo leadgen_id` mas `lead_id = lead antigo`. O e-mail novo nunca vira lead próprio; o `platform_lead_id` do lead antigo NÃO é atualizado.
4. A cada 2 minutos a Meta reentrega o mesmo `leadgen_id`. O bloco `IDEMPOTENCY GUARD` (linhas 65–134) faz:
   - HARD_DEDUPE por `lia_attendances.platform_lead_id` → não bate (lead antigo tem outro `platform_lead_id`).
   - Fallback por `lead_activity_log.entity_id` nas últimas 6h → BATE no registro fantasma da etapa 3 → retorna `DUPLICATE_SKIPPED` com 200.
5. Resultado: o e-mail `maria.silva@yahoo.com` aparece "processado com sucesso" nos logs, sem existir na CDP nem no Piperun.

### Evidência direta (Maria Silva)

| Campo | Payload novo | Lead existente que absorveu |
|---|---|---|
| Email | maria.silva@yahoo.com | maria.silva317@yahoo.com |
| Telefone | +5521996332093 | +5521996332093 |
| Nome | Maria Fatima Da Silva | Maria Fatima Da Silva |
| meta_leadgen_id | 2266383444132962 | platform_lead_id=2171507266979350 |
| lead_activity_log | entity_id=2266383444132962, lead_id=0ba4ff5c… (antigo) | — |

O mesmo padrão (telefone igual / e-mail diferente, ou primeiro contato em outro formulário com e-mail alternativo) explica os 9 casos.

## O que NÃO está acontecendo

- Os edge functions não retornam 500. Todas as chamadas retornam 200.
- Não há `downstream_dispatch_non_ok` ativo nos logs recentes.
- O `meta_lead_event_buffer` está vazio (não é o caminho usado por este fluxo).
- Não é falha de Piperun: a chamada simplesmente nunca é feita para esses e-mails.

## Plano de correção

### 1. Atualizar `platform_lead_id` quando o ingest absorve em lead existente
No `smart-ops-ingest-lead`, depois de identificar (ou criar) o lead canônico, escrever `platform_lead_id = dedupeId` na `lia_attendances` SE estiver vazio OU diferente, e registrar em `platform_lead_id_history` (jsonb append) para preservar histórico. Isso faz o HARD_DEDUPE da próxima cron bater corretamente e bloqueia o caminho fantasma do `lead_activity_log`.

### 2. Endurecer o match por identidade no `findOrCreate`
Antes de fundir por telefone+nome quando o e-mail é diferente, exigir uma de:
- mesmo domínio de e-mail (`@yahoo.com` x `@yahoo.com`), ou
- `localpart` igual depois de remover dígitos finais (`maria.silva` vs `maria.silva317`), ou
- `merge_intent` explícito.

Quando não atender, criar um lead NOVO e marcar `possible_duplicate_of = <lead_existente.id>` em vez de absorver silenciosamente. SDR resolve no card.

### 3. Tornar o dedupe por `lead_activity_log` consistente
Antes de retornar `DUPLICATE_SKIPPED` via `lead_activity_log`, validar:
- `lia_attendances.platform_lead_id = entity_id` OU
- `lia_attendances.email = payload.email` OU `telefone_normalized = payload.phone_normalized`.

Se nenhuma bater, ignorar o evento fantasma, prosseguir com criação normal e marcar `lead_activity_log` órfão para limpeza.

### 4. Backfill dos 9 leads perdidos
Script único:
- Para cada e-mail listado, buscar último payload no log de `smart-ops-ingest-lead` (já temos para Maria Silva, repetir para os outros 8).
- Reinjetar via `smart-ops-ingest-lead` com flag `force_new_identity=true` (bypassa o dedupe).
- Validar criação em `lia_attendances` + Person/Deal no Piperun.

### 5. Observabilidade
- Adicionar log estruturado `IDENTITY_COLLISION` quando o `findOrCreate` absorve um payload com e-mail diferente do canônico.
- Criar view `v_lead_identity_collisions` (últimos 30d) para o admin acompanhar.

## Detalhes técnicos (referência)

- Arquivo principal: `supabase/functions/smart-ops-ingest-lead/index.ts` linhas 60–140 (dedupe) e bloco `findOrCreate` (a ser inspecionado para o ajuste 2).
- Tabela: `lia_attendances` (`platform_lead_id`, `telefone_normalized`, `email`, `merged_into`).
- Tabela: `lead_activity_log` (`entity_id`, `event_type='meta_ads_lead_entry'`, `lead_id`).
- Migrations necessárias: nenhuma estrutural; opcional `platform_lead_id_history jsonb default '[]'` e coluna `possible_duplicate_of uuid` em `lia_attendances`.

## Resumo

Os 9 e-mails não foram "rejeitados por API externa". Eles foram **engolidos** por um lead pré-existente (match por telefone+nome) e, a partir daí, todas as reentregas da Meta caem no atalho `DUPLICATE_SKIPPED`. A correção é (a) consertar a chave de dedupe para refletir a realidade do banco e (b) impedir absorção silenciosa quando o e-mail diverge.
