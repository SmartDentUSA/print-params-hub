## Objetivo

Resolver de uma vez o **loop de re-entrega Meta** (form_submission inflando lead_activity_log e disparando syncs/updates fantasmas) e **maximizar a riqueza dos dados de formulário** que vão para o card do PipeRun (Pessoa + Deal).

---

## Parte 1 — Fim do loop de re-entrega Meta

### Diagnóstico (caso miguel.alm34@hotmail.com, 1.251 form_submission em ~30h)

O lead recebe duas variantes de `leadgen_id` da Meta (BLZ Ino200 e Ino100 Plus) que se alternam a cada 2 minutos. O guard atual falha porque:

1. `HARD_DEDUPE` só checa `lia_attendances.platform_lead_id` — uma única coluna escalar. A cada ciclo o bloco **PLATFORM_LEAD_ID SYNC** sobrescreve esse campo com o leadgen_id "do momento" e arquiva o anterior em `raw_payload.previous_platform_lead_ids`. O HARD_DEDUPE não consulta o arquivo, então a ALTERNÂNCIA X↔Y nunca casa.
2. Fallback por `lead_activity_log.entity_id` só olha as últimas 6h. Como os dois leadgen_ids voltam a aparecer várias vezes/dia, fora dessa janela o guard volta a deixar passar.
3. Cada passagem registra um novo `form_submission` em `lead_activity_log` (linha 928), dispara `lia-assign` (force_new_deal porque `formName` existe) e re-sincroniza tudo — multiplicando custo, ruído e risco de criar deal duplicado.

### Correção

**1.1. HARD_DEDUPE consulta também o arquivo de leadgen_ids**
- Buscar leads cujo `platform_lead_id = dedupeId` **ou** cujo `raw_payload->previous_platform_lead_ids` contenha `dedupeId` (via filtro `cs`/contains JSONB).
- Mesmo retorno `HARD_DEDUPE_SKIPPED` (não loga form_submission, não dispara `lia-assign`/`cognitive`/SellFlux).

**1.2. Não rebobinar `platform_lead_id` quando o novo já está arquivado**
- No bloco PLATFORM_LEAD_ID SYNC, se o `incomingPlatformLeadId` já está em `previous_platform_lead_ids` (ou já foi o atual no passado), **não sobrescrever** o atual. Apenas garantir que ambos estão arquivados.
- Resultado: a alternância X↔Y converge — depois da primeira passagem, qualquer leadgen_id da família é absorvido sem mexer no estado.

**1.3. Guard de "lead_activity_log" para form_submission de Meta repetido**
- Antes do `insert` em `lead_activity_log` (linha 928), se `source === "meta_lead_ads"` e o `entity_id` (leadgen_id) **já tem evento `meta_ads_lead_entry`/`form_submission`** registrado para este `lead_id` (sem janela de tempo), pular o insert. Usar um único `meta_lead_ads_redelivered` em `system_health_logs` (info) com contador por dia para visibilidade.

**1.4. Dedupe key estendido**
- O dedupe atual usa só `meta_leadgen_id`. Adicionar uma "chave de família" para Meta = `payload.platform_form_id + ":" + payload.email + ":" + telefone_normalized`. Se a chave já produziu lead nas últimas 24h, considerar duplicado mesmo quando o `leadgen_id` é totalmente novo (cobre o caso de a Meta gerar IDs diferentes para o MESMO submit, que parece ser o que ocorre nas re-entregas BLZ-Smart Dent).

**1.5. Backfill / contenção imediata**
- Remover registros redundantes de `lead_activity_log` (event_type IN ('form_submission','meta_ads_lead_entry'), source_channel='meta_lead_ads'), mantendo o primeiro por `(lead_id, entity_id)`. Migração SQL com `DELETE … USING row_number()`.
- Após a correção entrar em produção, validar via `SELECT lead_id, count(*) FROM lead_activity_log WHERE event_type='form_submission' AND created_at > now() - interval '1 day' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;` — meta: ≤ 1 evento por (lead, leadgen_id).

---

## Parte 2 — Maximizar dados do formulário no card do PipeRun

### Estado atual

- **Pessoa** (6 campos): área (673900), especialidade (445631), tem_impressora (546566), scanner (772727), impressora (772728), origem_lead (772511).
- **Deal** (5 campos): área (549241), especialidade (549059), produto (549058), tem_impressora (549243), produto_auto (549148).
- **Snapshot completo** já fica em `form_data` JSONB e `raw_payload.custom_fields_history`, mas **não chega ao card**. SDR precisa abrir Supabase para enxergar.

### Expansão

**2.1. Resumo executivo no campo "Nota inicial" do Deal**
- Estender `smart-ops-deal-form-note` para montar um bloco padronizado em markdown leve com TODAS as respostas (não só as que mudaram), agrupado por seção: Identificação, Equipamentos atuais, Interesse, Atendimento, UTMs.
- Inclui histórico das últimas 3 submissões (cap 3) quando o lead reenvia formulários — vendedor vê evolução sem sair do Deal.
- Hoje a nota é enviada só quando `incomingEmailDiffersFromCanonical` ou quando há campos atualizados. Mudar para: **sempre** que houver `form_responses` ou um snapshot novo em `form_data`.

**2.2. Mais custom_fields ativos no PipeRun**
Mapear/criar (verificar IDs reais no painel; lista de campos-alvo do lia_attendances que hoje não chegam):
- **Deal**: `utm_campaign`, `utm_source`/`utm_medium`, `origem_campanha`, `cidade/UF`, `produto_interesse_auto` (já existe), `volume_mensal_pecas`, `principal_aplicacao`, `software_cad`, `equip_scanner` (atual real), `equip_impressora` (atual real), `cs_treinamento`.
- **Pessoa**: `empresa_razao_social`, `empresa_cnpj`, `cidade`, `UF`, `software_cad`, `volume_mensal_pecas`, `tags_crm` (string concatenada).
- Centralizar a montagem do payload em **`_shared/piperun-custom-fields.ts`** (nova) com duas funções puras `buildPersonCustomFields(lead)` e `buildDealCustomFields(lead)`. Eliminar a duplicação atual entre os 3 blocos em `lia-assign` (linhas ~675, ~722, ~2300).

**2.3. Fallback configurável**
- Tabela `piperun_custom_field_map (entity 'person'|'deal', source_column, piperun_field_id, transform jsonb)` para o admin acrescentar mapeamentos sem deploy. As funções acima leem desta tabela como override do mapa hardcoded.

**2.4. Tag automática de campanha no Deal**
- Quando há `utm_campaign` ou `origem_campanha`, garantir tag PipeRun correspondente (ex.: `CAMP_<slug>`), além das tags já criadas (`J02_CONSIDERACAO`, `C_PRIMEIRO_CONTATO`).

**2.5. Re-aplicar enrichment para Deals existentes ao reabrir**
- Quando uma nova submissão chega num lead que já tem Deal aberto, hoje só vira nota. Adicionar PUT em `deals/{id}` com `buildDealCustomFields(merged_lead)` para refletir respostas novas (ex.: lead respondeu "quero impressora também").

---

## Detalhes técnicos (referência)

- **Arquivos a editar**
  - `supabase/functions/smart-ops-ingest-lead/index.ts` — itens 1.1, 1.2, 1.3, 1.4.
  - `supabase/functions/smart-ops-lia-assign/index.ts` — itens 2.2, 2.4, 2.5; remover blocos duplicados de CF.
  - `supabase/functions/smart-ops-deal-form-note/index.ts` — item 2.1.
  - **Novo**: `supabase/functions/_shared/piperun-custom-fields.ts`.
- **Migrações**
  - `DELETE` de `lead_activity_log` órfão (1.5).
  - `CREATE TABLE piperun_custom_field_map` (2.3).
  - Índice em `lia_attendances ((raw_payload->'previous_platform_lead_ids'))` GIN para a query do 1.1.
- **Sem mudança de comportamento para**: round-robin de vendedores, lock cognitivo, fluxo de CRM de leads novos, política Person Origin (memória `person-origin-and-company-name-detection`).
- **Memórias a atualizar pós-deploy**: `architecture/commercial-intent-guard` (anotar nova chave-família), `integration/piperun-person-custom-fields-activation` (lista expandida), `architecture/postgrest-embed-update-guard` (continua válido — payload de CF é flat).

## Validação

1. Reprocessar miguel.alm34@hotmail.com (manual replay do payload Meta) → esperado: `HARD_DEDUPE_SKIPPED` em < 50 ms, **zero** linha nova em `lead_activity_log`, **zero** chamada `lia-assign`.
2. Submeter formulário público novo de um e-mail novo → Pessoa criada no PipeRun com **todos** os CFs novos preenchidos; Deal idem; nota com resumo executivo.
3. Reenviar o mesmo formulário pelo lead → nota adicional aparece no Deal, CFs atualizados, sem novo Deal.
4. Métrica de saúde: `SELECT count(*) FROM lead_activity_log WHERE event_type='form_submission' AND created_at > now()-interval '24 hours';` cai para < 5% do valor atual.