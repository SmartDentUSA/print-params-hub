## Auditoria profunda — Inconsistências e gaps mapeados

Investigação read-only em `lia_attendances`, `lead_activity_log`, `system_health_logs`, edge functions de criação (ingest-lead, lia-assign, piperun-webhook, sellflux-webhook, ecommerce-webhook) e helpers PipeRun (`_shared/piperun-*`).

---

## SINAIS QUANTITATIVOS (estado atual da base)

| Métrica | Valor | Severidade |
|---|---|---|
| Leads canônicos duplicados pela mesma `pessoa_piperun_id` | **135 pessoas / 142 leads excedentes** | 🔴 ALTA |
| Leads canônicos duplicados pelo mesmo telefone normalizado | **279 telefones / 291 leads excedentes** | 🔴 ALTA |
| Leads canônicos duplicados pelo mesmo email | 0 | ✅ OK |
| Leads canônicos com `piperun_id` (deal) **sem `pessoa_piperun_id`** | **2.511** | 🔴 ALTA |
| Leads 30d sem `pessoa_piperun_id` após processamento | 116 | 🟡 MÉDIA |
| Leads 30d sem `empresa_piperun_id` (pessoa criada) | 483 | 🟡 MÉDIA |
| `vendas_duplicates_consolidated` em 30d | **194 eventos** | 🔴 confirma criação repetida |
| `deal_reativado_via_redelivery` últimos 7d (deals novos criados via re-entrega) | **230** | 🔴 ALTA |
| `piperun_email_silently_rejected` (resolver) | **23.711** | 🔴 erro recorrente |
| `person_name_is_company` warnings | 61.423 | 🟡 ruído + risco SDR |
| Pares CNPJ↔empresa_piperun_id inconsistentes | 23 CNPJs com múltiplas Companies + 13 Companies com múltiplos CNPJs | 🟡 MÉDIA |
| `family_dedupe_lifetime` em 30d | **0 eventos** | 🔴 dedupe família silenciosamente quebrado |
| `vendas_gap_detected` (reconciler) 7d | 167 (severity=critical) | 🔴 ALTA |
| `evolution_wrong_token` 7d | 72 (critical) | 🟡 fora do escopo |

---

## GAPS CRÍTICOS DE PROCESSO

### GAP 1 — Regra de ouro não cobre o fluxo PRIMÁRIO (`executeLiaAssign`)
Os Guards A/B/C/D que implementei na sessão anterior protegem apenas `executarEnrichmentDealRoute` (re-entrega Meta com dedupe HIT). Quando uma re-entrega cria um **novo** `lia_attendances` (porque `FAMILY_DEDUPE` não bateu — form_id diferente, variação de email/telefone, ou leadgen_id novo), cai no fluxo primário `executeLiaAssign` que executa: createPerson → Round Robin → createNewDeal sem verificar deals VENDAS prévios. Resultado: pessoa que já tem 10 deals fechados recebe o 11º.

**Evidência:** lead `c7b68aff` (Otomar Cunha, pessoa 46560614) — log mostra `Person 46560614: 10 deals total, 0 open, 0 won` → cria deal #11 sem checar histórico VENDAS.

### GAP 2 — `FAMILY_DEDUPE_LIFETIME` está silenciosamente desligado
**0 eventos em 30 dias** apesar do código existir em `smart-ops-ingest-lead/index.ts:240`. A chave de família (form_id + email + phone) provavelmente não bate por:
- Normalização inconsistente de phone (com/sem `55`, com/sem `9`)
- Variação de `form_id` entre re-entregas
- Falha silenciosa do try/catch

Isso significa que **toda re-entrega Meta cai no fluxo primário** → alimenta GAP 1.

### GAP 3 — 2.511 leads com deal mas sem `pessoa_piperun_id`
Leads canônicos com `piperun_id` preenchido (deal existe no PipeRun) mas `pessoa_piperun_id IS NULL`. Hipóteses:
- Deal criado por caminho que não atualizou de volta `lia_attendances.pessoa_piperun_id`
- Hidratação assíncrona do piperun-webhook chegou antes do `executeLiaAssign` salvar
- Race condition entre webhook PipeRun e ingest-lead

Impacto: bloqueia Guard D (que exige `personId`), quebra Copilot 360, quebra busca por histórico de pessoa.

### GAP 4 — 142 leads canônicos apontam para a mesma `pessoa_piperun_id`
Regra de ouro diz `piperun_id > email > phone` mas o merge não está rodando após o lead canônico ser criado. Top exemplo: pessoa `29064441` tem 5 leads canônicos distintos (4 com email placeholder `import_*@placeholder.local`).
- Imports CSV criam leads com email placeholder e mesmo `pessoa_piperun_id`
- O auto-merge (`lead-merge-system-v2`) só roda no acesso ao card, não no INSERT

### GAP 5 — 279 telefones com leads canônicos duplicados
Normalização de telefone é inconsistente. Exemplos do dump: `[ 555196076501, 559991212918]` e `[47999178445, 554799178445]` (mesmo número com/sem prefixo 55). O `phone_dedup_log` existe mas não está garantindo unicidade no INSERT.

### GAP 6 — `piperun_email_silently_rejected` 23.711 ocorrências
Em `_shared/piperun-person-resolver.ts:423` o PUT de email/phone está sendo "silenciosamente rejeitado" pelo PipeRun (provavelmente conflito de email único). O sistema marca como erro mas não bloqueia o fluxo → Person fica sem contato → backfill posterior tenta corrigir (32.987 `piperun_person_contact_backfilled`).
**Loop de retrabalho** consumindo quota PipeRun.

### GAP 7 — `vendas_gap_detected` 167× em 7d (severity=critical)
`piperun_funnel_reconciler` está acusando deals VENDAS faltando vs PipeRun. Indica desalinhamento entre snapshot interno e estado real do CRM (deals criados/movidos sem registro local).

### GAP 8 — Companies duplicadas / CNPJs inconsistentes
- **23 CNPJs** existem em múltiplos `empresa_piperun_id` distintos (mesma empresa cadastrada várias vezes)
- **13 empresas** têm CNPJs diferentes registrados (provável merge errado)
`createCompany` em `_shared/piperun-hierarchy.ts:170` **não tem dedup por CNPJ antes de criar**.

### GAP 9 — Person POST com `job_title` malformado
Log mostra `"job_title":"[\"TÉCNICO EM PRÓTESE ODONTOLÓGICA\"]"` (string JSON dentro de string). Algum mapper está fazendo `JSON.stringify` em array que já vai como string. PipeRun aceita, mas o valor armazenado é lixo.

### GAP 10 — `retry_cron_contamination_2026_05_11` bloqueou 17 leads
Sinal de bug histórico do `smart-ops-piperun-retry-failed-leads` cron que contaminou leads (provavelmente recriando deals para leads já processados). Backfill bloqueou via flag mas o **mecanismo de contaminação pode reincidir** se o cron rodar sem o guard que adicionei.

### GAP 11 — `person_name_is_company` 61.423 warnings em 7d
Detector existe (`isCompanyLikeName`) e marca lead para revisão SDR, mas **não bloqueia** criação de Person no PipeRun com nome de razão social. Resultado: PipeRun acumula Persons que são na verdade empresas.

### GAP 12 — `createNewDeal` não checa `commercial_override` na rota primária
`_shared/commercial-intent.ts` é usado em `lia-assign` linha 2460, mas o retry cron e o sellflux-webhook podem chamar `createNewDeal` sem passar pelo intent guard. Resultado: deals criados para leads não-comerciais (Astron, e-commerce WA).

### GAP 13 — Ausência de retry/backoff em `piperunPost`
`piperun-field-map.ts:1352` faz POST sem retry. Se PipeRun retorna 5xx ou rate limit, **o lead fica órfão** (Person criada mas deal não, ou nada criado). Sem fila de reprocessamento síncrono.

### GAP 14 — `updateExistingDeal` sobrescreve campos sem snapshot
Linha 757 e 803 fazem PUT com `custom_fields` calculados de novo a cada re-entrega. Não há comparação prévia → re-entrega Meta com payload incompleto pode REGRESSAR campos enriquecidos antes (ex: scanner_marca preenchido cai para vazio).

### GAP 15 — Round Robin reatribui owner em CASE C mesmo quando pessoa já tinha owner anterior
`executarEnrichmentDealRoute` linha ~2274 chama `pickRandomActiveVendedor` sem verificar `proprietario` anterior da pessoa. Lead que era do Evandro vai para o Lucas no dia seguinte, fragmentando o histórico do vendedor.

### GAP 16 — `cognitive_lead_locks` sem cleanup periódico chamado
Existe `cleanup_orphan_cognitive_locks()` mas não está agendada em cron. Locks de >5min ficam pendentes se a função crashar antes do release.

### GAP 17 — `meta_lead_event_buffer` sem ttl/limpeza
Tabela cresce indefinidamente. Sem rotação.

### GAP 18 — `lia_attendances` tem **565 colunas** (memória mostra)
Sintoma de schema sem normalização. Aumenta risco de race condition em UPDATE (PostgREST embed-update guard já existe, mas pressão sobre planner).

---

## RECOMENDAÇÕES PRIORITIZADAS (ordem de impacto)

### 🔴 P0 — Estancar criação duplicada de deals (esta semana)
1. **Estender Guard D para o fluxo primário** `executeLiaAssign`: antes de `createNewDeal`, checar se a pessoa já tem **qualquer deal VENDAS** (aberto OU Perdido <30d). Se sim, NÃO criar — apenas atualizar o existente e adicionar nota.
2. **Consertar `FAMILY_DEDUPE_LIFETIME`**: normalizar phone e email antes de montar `family_key`; logar quando a chave é construída para validar que está sendo computada.
3. **Bloquear `createPerson` quando já existe Person com mesmo email/phone normalizado** no PipeRun (cascata: email exact → phone digits → name+localpart). Helper existe (`findPersonByEmail`/`Phone`) mas não é invocado universalmente.

### 🔴 P0 — Backfill `pessoa_piperun_id` nos 2.511 leads
Job idempotente que, para cada lead canônico com `piperun_id` mas sem `pessoa_piperun_id`, faz `GET deals/{id}` no PipeRun e popula `pessoa_piperun_id` + `empresa_piperun_id`. Desbloqueia Guard D retroativamente.

### 🟡 P1 — Dedup de telefone e Person
1. Normalizar phone em UMA função compartilhada (`_shared/phone-normalize.ts`) e usar em TODOS os pontos de INSERT/UPDATE.
2. Job de merge contínuo: leads canônicos com mesma `pessoa_piperun_id` → unificar no mais antigo (sem tocar deals VENDAS/CS).
3. Dedup de Company por CNPJ normalizado antes de `createCompany`.

### 🟡 P1 — Eliminar loop `piperun_email_silently_rejected`
Investigar 5 casos: identificar se rejeição é por email duplicado em outra Person → resolver via merge ou skip. Adicionar fallback: se PUT email rejeitado, **não tentar de novo no backfill** (anti-loop).

### 🟡 P1 — Snapshot antes de `updateExistingDeal`
Comparar campos atuais do deal vs novo payload e enviar PUT apenas com diff que **adiciona** (nunca esvazia campo previamente preenchido).

### 🟢 P2 — Limpezas operacionais
1. Agendar `cleanup_orphan_cognitive_locks()` a cada 5min.
2. TTL/rotação em `meta_lead_event_buffer` (>30d).
3. Bloquear `createPerson` com nome razão-social até revisão SDR (atualmente só warning).
4. Sanear `job_title` mapper (não fazer `JSON.stringify` em string).
5. Padronizar `commercial-intent` guard em todos os pontos que chamam `createNewDeal` (incluindo retry-cron e sellflux-webhook).

---

## NÃO ALTERAR (regra de ouro mantida)

- Deals existentes em VENDAS e CS (nenhuma reabertura, fechamento, mudança de stage ou owner em deals históricos)
- Pipelines protegidos CS_ONBOARDING / GANHOS_ALEATORIOS_CS
- Schema de `lia_attendances`, `lead_activity_log`, `deals`
- Frontend, LeadDetailPanel, contratos PipeRun/SellFlux

---

## Próximo passo

Este plano é **relatório de auditoria**. Para evoluir preciso da sua priorização:

1. Implemento agora o **P0 #1** (estender Guard D ao fluxo primário) — único caminho para parar a sangria de deals novos?
2. Ou rodo primeiro o **P0 #2** (backfill dos 2.511 `pessoa_piperun_id`) — pré-requisito para Guard D funcionar 100%?
3. Ou abro investigação dedicada do **GAP 2** (FAMILY_DEDUPE quebrado), que é a causa raiz upstream de todos os loops?

Posso fazer os 3 em sequência ou em paralelo — me diga em qual ordem.