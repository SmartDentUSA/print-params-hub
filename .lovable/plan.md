
# Aba "Reativação & Fluxos" — Editor completo com dropdowns dinâmicos e mapa de regras existentes

Nova aba no SmartOps organizada em **5 sub-abas**:

```
[Regras LTV] [Fluxos Editor] [Ingestão de Leads] [Regras CRM] [Configurações]
```

Cada campo de configuração é **dropdown/seletor dinâmico** — nunca texto livre para IDs. As duas abas centrais ("Ingestão de Leads" e "Regras CRM") descrevem e **visualizam tudo que hoje existe em código**, servindo de fonte da verdade viva.

---

## Dropdowns dinâmicos (base compartilhada)

Todos os seletores são populados por hooks que leem dados reais:

| Seletor | Fonte | Hook |
|---|---|---|
| Pipeline PipeRun | edge `piperun-list-pipelines` | `usePiperunPipelines()` |
| Etapa (stage) PipeRun | edge `piperun-list-stages?pipeline_id` | `usePiperunStages(pipelineId)` |
| Motivo de perda | edge `piperun-list-loss-reasons` | `usePiperunLossReasons()` |
| Vendedor | `team_members` where `ativo=true` | `useActiveTeamMembers()` |
| Produto/categoria | `system_a_catalog` + `product_taxonomy` | `useCatalogProducts()`, `useProductCategories()` |
| Origem/campanha | distinct `campaign_name`/`origem` de `lia_attendances` | `useLeadOrigins()` |
| Formulário | `smartops_forms` where `active=true` | `useSmartOpsForms()` |
| Fluxo | `operational_flows` | `useOperationalFlows()` |
| Célula workflow 7×3 | constantes das 25 células | `useWorkflowCells()` |
| Template WaLeads | `whatsapp_templates` | `useWhatsappTemplates()` |
| Régua CS existente | `cs_automation_rules` | `useCsRules()` |

Cache curto (5min) + botão "Atualizar" em cada dropdown. Todos com busca (`Command` do shadcn).

---

## 1. Sub-aba "Regras LTV"

### Tabelas
`ltv_reactivation_rules` e `ltv_reactivation_runs` (mesmo modelo do plano anterior).

### Formulário de regra — 100% com seletores
- Nome (texto)
- Ativo (toggle)
- Pipeline origem (CS) — **dropdown PipeRun**
- Pipeline destino (LTV) — **dropdown PipeRun**
- Etapa inicial no LTV — **dropdown PipeRun stages** filtrado pelo pipeline destino
- Pipeline LTV Perdidos — **dropdown PipeRun**
- Motivo de perda "LTV" — **dropdown motivos**
- Cadências — chips numéricos ([30, 60, 120] editáveis, adiciona/remove)
- Estratégia de vendedor — **dropdown** (original / round-robin sobre team_members ativos / fixo)
- Vendedor fixo — **dropdown team_members** (aparece se estratégia = fixo)
- Sugestão de produto — **dropdown** (último comprado / categoria / manual)
- Categoria manual — **dropdown categorias**
- Produtos sugeridos — **multi-select catalog**
- Origem tag — template com placeholder `{days}` (preview em tempo real: `#LTV-Ativo-30`)
- Notificar vendedor — toggle
- Template WaLeads — **dropdown whatsapp_templates**
- Mín LTV (numérico), máx deals LTV abertos (numérico), cooldown dias (numérico)
- Dry-run (toggle)

### UI extras
- Painel de execuções (`ltv_reactivation_runs`) filtrável por status/regra/data
- Botão "Simular hoje" mostra quantos deals seriam criados e por qual regra

---

## 2. Sub-aba "Fluxos Editor" (ReactFlow)

Motor genérico `_shared/flow-engine.ts` com nós tipados (`trigger`, `filter`, `enrich`, `route`, `guard`, `action`, `branch`, `end`).

Tabelas: `operational_flows`, `operational_flow_versions`, `operational_flow_shadow_log`.

### UI
- Canvas ReactFlow, palette de tipos, sidebar de propriedades com form auto-gerado via `@rjsf/core` + validators dos JSON Schemas em `src/lib/flows/nodeSchemas.ts`
- **Propriedades de nó também usam dropdowns dinâmicos** — ex.: nó `action.create_deal` mostra dropdowns de pipeline/stage/vendedor; nó `route.round_robin` lista team_members ativos com checkbox por vendedor
- Botões Salvar rascunho / Publicar / Ativar shadow / Restaurar versão / Diff / Dry-run
- Toggle `active` por fluxo — off usa fallback hardcoded

Seed de 5 flow_keys equivalentes ao comportamento atual: `ingest_lead`, `assign`, `cs_rule`, `ltv`, `form_ingest`.

---

## 3. Sub-aba "Ingestão de Leads" — Mapa vivo do código

Página **read-first, edit-second** que documenta e visualiza tudo que hoje está em código sobre entrada de leads.

### Painéis
1. **Diagrama de entrada** — ReactFlow read-only com todas as fontes atuais:
   - Meta Lead Ads → `smart-ops-ingest-lead`
   - Formulários SmartOps → `smart-ops-ingest-lead`
   - SellFlux webhook → `smart-ops-ingest-lead`
   - E-commerce (Loja Integrada) → ingestão dedicada
   - PipeRun webhook → `piperun-webhook`
   - Import CSV → `import-leads-csv`, `smart-ops-csv-*-backfill`
   Cada nó clicável abre painel lateral com: função edge, tabelas envolvidas, guards aplicados, link para logs.

2. **Fontes ativas** — tabela lida de `edge_function_catalog` (funções de ingestão) + toggles ativo/inativo por fonte

3. **Filtros de segurança** — cartões descrevendo os filtros hoje hardcoded (email obrigatório, domínios de teste, commercial intent guard) com toggle para desativar (com confirmação de risco) — persiste em `operational_flows.ingest_lead.graph`

4. **Política de merge por campo** — tabela editável mostrando cada campo relevante de `lia_attendances` com **dropdown de política** (PROTECTED / ALWAYS_UPDATE / MERGE_ARRAYS / MERGE_JSONB / ENRICHMENT_ONLY). Valores default lidos do código atual e migrados para linha em `operational_flows`

5. **Identificadores canônicos** — visualização da cascata `piperun_id > email > phone` com **dropdown para reordenar prioridade**

6. **Mapeamento formulário → coluna** — lista todos `smartops_form_fields` com `db_column` / `workflow_cell_target`, editável inline

7. **Timeline de ingestão real** — últimos 50 eventos com badge da fonte

Nada aqui é "documentação estática" — cada painel lê o schema atual + configs em `operational_flows`, então descreve o comportamento vivo.

---

## 4. Sub-aba "Regras CRM" — Todas as regras que tocam PipeRun

Similar à anterior, mas focada em CRM.

### Painéis
1. **Diagrama de saída CRM** — ReactFlow read-only com fluxos que criam/atualizam PipeRun:
   - Person/Empresa/Deal via `smart-ops-lia-assign`
   - Deal reactivation (LTV, retivação, SDR-Captação)
   - Nota unificada de vendedor (`try_claim_seller_note_slot`)
   - Webhook PipeRun de status
   - Régua CS (`smart-ops-cs-processor`)
2. **Golden Rule** — cartão descritivo com toggle (fixo por default, exige confirmação)
3. **Commercial Intent Guard** — lista whitelist de sources permitidos, **dropdown** para adicionar/remover
4. **Distribuição / Round-robin** — tabela `team_members` com peso editável + fallback "Distribuidor de Leads" configurável (dropdown)
5. **Regras de reativação existentes** — mostra:
   - `reactivation_rules` (mensagens D0/D3/D7)
   - `reactivation_sequences` (histórico)
   - `cs_automation_rules` (régua CS)
   - `ltv_reactivation_rules` (novo)
   Cada bloco linka para seu editor específico.
6. **Motivos de perda / mapeamento status** — dropdowns lendo `piperun_stage_map_overrides` + edição inline
7. **Custom fields PipeRun** — lista campos custom ativos, com dropdown para (des)ativar e mapear para coluna de `lia_attendances`
8. **Person origin frozen** — visualização de quais campos são congelados no primeiro contato — toggle por campo

---

## 5. Sub-aba "Configurações"

Singleton `operational_settings`:
- Pipelines default (CS, VENDAS, LTV, LTV Perdidos) — **dropdowns PipeRun**
- Cadências default LTV — chips
- Estratégia default de vendedor — dropdown
- Horário do cron LTV — time picker
- Modo de rollout — dropdown (direct / shadow) + duração shadow em dias
- Guards não-removíveis — checkbox por guard (Golden Rule, commercial intent, person origin frozen, dedupe)
- Estado de migração por flow_key — badge (hardcoded / shadow / active) + botão promover

---

## Backend

### Edge functions novas
- `piperun-list-pipelines`, `piperun-list-stages`, `piperun-list-loss-reasons` — leituras cacheadas do PipeRun para dropdowns
- `smart-ops-ltv-reactivation` (cron), `smart-ops-ltv-mark-lost` (hook)
- `smart-ops-flow-dryrun`

### Alterações
- `smart-ops-ingest-lead`, `smart-ops-lia-assign`, `smart-ops-cs-processor` — passam a chamar `executeFlow(flow_key)` com fallback hardcoded controlado por toggle
- Migration cria: `ltv_reactivation_rules`, `ltv_reactivation_runs`, `operational_flows`, `operational_flow_versions`, `operational_flow_shadow_log`, `operational_settings`

---

## Frontend — arquivos a criar
```
src/hooks/piperun/usePiperunPipelines.ts
src/hooks/piperun/usePiperunStages.ts
src/hooks/piperun/usePiperunLossReasons.ts
src/hooks/useActiveTeamMembers.ts
src/hooks/useCatalogProducts.ts
src/hooks/useProductCategories.ts
src/hooks/useWhatsappTemplates.ts
src/lib/flows/nodeSchemas.ts
src/components/smartops/reactivation/
  SmartOpsReactivationHub.tsx        (5 sub-tabs)
  LtvRules.tsx / LtvRuleEditor.tsx / LtvRunsPanel.tsx
  FlowEditor.tsx / FlowNodeProperties.tsx / FlowVersionHistory.tsx
  IngestionMap.tsx (mapa vivo)
  CrmRulesMap.tsx  (mapa vivo)
  ReactivationSettings.tsx
  common/PipelineSelect.tsx / StageSelect.tsx / SellerSelect.tsx /
         ProductMultiSelect.tsx / TemplateSelect.tsx / OriginSelect.tsx
```

### Dependências
`reactflow`, `@rjsf/core`, `@rjsf/validator-ajv8`

---

## Ordem de entrega
1. Hooks + edges de dropdowns (base compartilhada)
2. Configurações globais (Sub-aba 5)
3. Regras LTV completas (Sub-aba 1)
4. Mapa "Ingestão de Leads" read-only (Sub-aba 3)
5. Mapa "Regras CRM" read-only (Sub-aba 4)
6. Motor de fluxos + editor (Sub-aba 2)
7. Migração progressiva de edge functions com shadow mode

Confirma que essa estrutura cobre o que você quer? Se sim, sigo para build.
