## O que aconteceu (root cause confirmada)

Verifiquei a Bruna no banco:

- `email = bruna.mascarenhas001@gmail.com`
- `source = astron_postback` · `form_name = NULL` · `form_data = {}` · `origem_campanha = NULL`
- `created_at = 2026-04-28` (entrou só pelo postback do Astron Academy)
- `raw_payload.piperun_retry_last_attempt_at = 2026-05-11T20:35:00Z` ← horário exato em que o Deal `59696402` apareceu no PipeRun
- `raw_payload.piperun_retry_attempts = 0` + `piperun_retry_succeeded_at = 2026-05-11T20:35:00Z`

**Quem criou o Deal:** o cron `smart-ops-piperun-retry-failed-leads`. Ele varre TODA lead com `piperun_id IS NULL` criada nos últimos `lookback_days` e chama `smart-ops-lia-assign` com `force: true`. Não há filtro por `source`. Resultado: leads que entraram apenas via Astron Academy (alunos de curso), apenas via e-commerce, ou apenas via WhatsApp inbound viram "candidatos" a virar Deal comercial — exatamente a regra que quebrou.

**Por que o lia-assign não barrou:** `smart-ops-lia-assign` também não tem nenhuma checagem de `source`/`form_name`/intenção comercial antes de criar Person+Deal no PipeRun. Ele assume que quem o chamou já decidiu que vira Deal.

**Por que a notificação veio toda N/A:** `form_data = {}`, então os campos formulário (área, especialidade, interesse, telefone, formulário) ficam vazios. O template imprime "N/A".

**Por que a análise cognitiva alucinou ("nunca fez login" com 11 cursos concluídos):** o prompt da `cognitive-lead-analysis` recebeu `astron_last_login_at = NULL` (o sync do Astron nunca preencheu essa coluna pra ela) e o LLM inferiu "nunca logou", contradizendo `astron_courses_completed = 11`. Bug de prompt: hoje passamos um campo que não existe e deixamos o modelo inventar.

## Plano de correção

### 1. Whitelist de fontes que podem virar Deal (camada de defesa em profundidade)

Definir uma única função utilitária `isCommercialSource(lead)` em `supabase/functions/_shared/lead-enrichment.ts` (ou novo `_shared/commercial-intent.ts`):

```text
Deal-elegível somente se QUALQUER um:
  - lead.form_name não-vazio (formulário comercial real)
  - lead.source ∈ {meta_lead_ad, manual_form, smart_dent_form,
                    sellflux_webhook, piperun_webhook, dra_lia_chat_qualified,
                    csv_import_commercial, wa_inbound_qualified}
  - lead.piperun_id já existe (já é Deal)
  - lead.crm_won = true ou lead.empresa_cnpj presente vindo de Omie/CRM
Bloqueado:
  - source ∈ {astron_postback, ecommerce_order, sync_astron_members,
              wa_inbound (sem qualificação), unknown}
    E sem form_name E sem piperun_id existente
```

### 2. Guardar o cron `smart-ops-piperun-retry-failed-leads`

- Adicionar o filtro de `source` na query (`.in("source", COMMERCIAL_SOURCES)` + OR `not("form_name", "is", null)`).
- Antes do POST a `lia-assign`, chamar `isCommercialSource(lead)` e, se falso, marcar `raw_payload.piperun_retry_skipped_reason = "non_commercial_source"` + `piperun_retry_succeeded_at = null` para nunca mais ser tentado, sem criar Deal.
- Logar em `system_health_logs` (`error_type = "retry_skipped_non_commercial"`).

### 3. Guardar o `smart-ops-lia-assign` (último portão)

No início do handler, depois de carregar a lead e antes de qualquer chamada PipeRun:

- Se `isCommercialSource(lead)` for falso E o caller não passar `commercial_override: true` (reservado para chat Dra. LIA quando o lead pediu orçamento explícito), abortar com `409 non_commercial_lead`, logar `system_health_logs.error_type = "lia_assign_blocked_non_commercial"` e atualizar `crm_creation_blocked = true` + `crm_creation_blocked_reason = "non_commercial_source"`.
- Isso protege contra qualquer caller futuro (manual, retry, dra-lia mal-configurado).

### 4. Reparo retroativo da Bruna e dos similares

- Migration de dados (via tool de inserts): para a Bruna especificamente, marcar `crm_creation_blocked = true`, limpar `piperun_retry_succeeded_at`, e registrar nota no `piperun_deals_history` indicando que o Deal `59696402` foi criado por engano pelo retry-cron.
- **Não** apagar o Deal no PipeRun automaticamente — apresentar lista para você decidir manualmente (pode ter outros casos similares dos últimos 7 dias).
- Query de auditoria a rodar e mostrar antes de qualquer DELETE: leads com `source IN ('astron_postback','ecommerce_order')` que receberam `piperun_id` via cron entre `2026-05-04` e hoje.

### 5. Corrigir a alucinação da análise cognitiva

Em `supabase/functions/cognitive-lead-analysis/index.ts`:

- Quando `astron_last_login_at IS NULL` mas `astron_courses_completed > 0`, **não** dizer "nunca logou". Trocar a frase por "Sem timestamp de último login disponível, mas concluiu N/M cursos — engajamento ativo na Academy".
- Adicionar guard rail no system prompt: "Se houver contradição entre sinais (ex.: cursos concluídos > 0 mas sem último login), confiar nos cursos concluídos e ignorar o NULL."

### 6. Notificação WhatsApp para leads não-comerciais

Quando um lead Astron-only entra no sistema (postback), não disparar a notificação "🤖 Novo Lead atribuído - Dra. L.I.A." — esse template é exclusivo de leads comerciais. Hoje ele está vazando porque o retry cron acionou `lia-assign`, que dispara a notificação. Com a guarda do passo 3 isso para automaticamente.

## Detalhes técnicos

Arquivos a editar:

- `supabase/functions/_shared/commercial-intent.ts` (novo) — função `isCommercialSource(lead)` + lista canônica de sources.
- `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` — filtro na query + skip + log.
- `supabase/functions/smart-ops-lia-assign/index.ts` — guard inicial + log + atualização de `crm_creation_blocked`.
- `supabase/functions/cognitive-lead-analysis/index.ts` — fix de prompt/heurística para Astron sem `last_login_at`.
- Migration de dados: reset da Bruna + auditoria dos últimos 7 dias.

Arquivos NÃO alterados:

- `astron-postback`, `sync-astron-members`, `poll-loja-integrada-orders` — eles já estão corretos: nunca chamam `lia-assign` diretamente. O bug está no cron + na ausência de guard no `lia-assign`.

## Antes de implementar — confirme:

1. **Lista de sources comerciais** acima está correta? Falta alguma (ex.: `manychat_webhook`, `tally_form`, alguma origem própria)?
2. **Reparo da Bruna no PipeRun:** quer que eu (a) só bloqueie no Supabase e te liste o Deal pra você apagar à mão, ou (b) chame a API do PipeRun pra marcar o Deal como `lost` com motivo "criado por engano - lead Astron"?
3. **Auditoria retroativa:** rodo a query dos últimos 7 dias e te mostro a lista antes de qualquer ação, certo?