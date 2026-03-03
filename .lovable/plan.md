

# Auditoria: PipeRun vs Kanban — Gaps Encontrados

## 1. Status da Sincronização PipeRun → Supabase

A sincronização `smart-ops-sync-piperun` **nunca foi executada recentemente** (sem logs nos analytics). Isso significa que a base `lia_attendances` depende exclusivamente do webhook (`smart-ops-piperun-webhook`) para manter sincronia. Deals movidos manualmente no PipeRun sem acionar o webhook ficam dessincronizados.

**PipeRun tem 15.543 deals no Funil de Vendas e 38.081 no Funil Estagnados. O Supabase tem apenas 24.580 leads totais.** A diferença é esperada (PipeRun inclui deals ganhos/perdidos/fechados que não ficam no Kanban), mas indica que a sincronização batch não está sendo executada periodicamente.

## 2. Kanban NÃO espelha todos os funis do PipeRun

### Funil de Vendas (18784) — 7 etapas no PipeRun vs 8 colunas no Kanban

| PipeRun Stage (ID) | Kanban Key | Status |
|---|---|---|
| Sem Contato (99293) | `sem_contato` | OK |
| Contato Feito (99294) | `contato_feito` | OK |
| Em Contato (379942) | `em_contato` | OK |
| Apresentação/Visita (99295) | `apresentacao` | OK |
| Proposta enviada (99296) | `proposta_enviada` | OK |
| Negociação (448526) | `negociacao` | OK |
| Fechamento (99818) | `fechamento` | OK |
| — | `novo` | **GAP**: "Novo" não existe no PipeRun. 541 leads com status `novo` nunca sincronizam para nenhuma etapa do CRM. |

### Funil Estagnados (72938) — 10 etapas no PipeRun vs 6 colunas no Kanban

| PipeRun Stage (ID) | Kanban Key | Status |
|---|---|---|
| Etapa 00 - Novos (447250) | `est_etapa1` | Mapeado junto com 01 |
| Etapa 01 - Reativação (447251) | `est_etapa1` | OK |
| Etapa 02 - Reativação (542160) | `est_etapa2` | OK |
| Etapa 03 - Reativação (542161) | `est_etapa3` | OK |
| Etapa 04 - Reativação (447252) | `est_etapa4` | OK |
| Apresentação/Visita - Estag (447253) | `est_apresentacao` | OK |
| Proposta Enviada - Estag (447254) | `est_proposta` | OK |
| Fechamento - Estag (447255) | `estagnado_final` | OK |
| Auxiliar (544565) | Não mapeado no Kanban | **GAP**: leads nesta etapa desaparecem |
| Get new Owner (545087) | Não mapeado no Kanban | **GAP**: leads nesta etapa desaparecem |

### CS Onboarding (83896) — 15 etapas no PipeRun vs 2 colunas no Kanban

| PipeRun Stage | Kanban Key | Status |
|---|---|---|
| Em Espera (535465) | `cs_em_espera` | OK |
| Sem Data/Agendar (523977) | `cs_agendar` | **ERRO**: `cs_agendar` não existe no `STAGE_TO_ETAPA` — mapeado como `cs_sem_data_agendar` |
| 13 etapas restantes | Não visíveis | **GAP CRÍTICO**: 13 etapas CS (Treinamento Agendado, Realizado, Enviar IMP3D, etc.) existem no PipeRun e no `STAGE_TO_ETAPA` mas **NÃO aparecem no Kanban** |

O Kanban mostra apenas 2 das 15 etapas CS. Leads em `cs_treinamento_agendado` (4 leads), `cs_sem_data_agendar` (4 leads) estão na base mas invisíveis no painel.

### Funil Insumos (100412) — 5 etapas no PipeRun vs 0 colunas no Kanban

23 leads com status `insumos_*` existem na base mas **não aparecem em nenhum lugar do Kanban**.

### Funil E-commerce (102702) — NOVO pipeline no PipeRun

Pipeline 102702 "E-commerce" com 8 etapas (Visitantes, Navegação site, Inicializou checkout, Abandonou carrinho, Status da transação, Status do pedido, Pós venda, Ativação mensal). **Não está mapeado no `piperun-field-map.ts` nem no Kanban.**

## 3. BUG CRÍTICO: Drag-and-drop NÃO sincroniza com PipeRun

O `handleDrop` no Kanban faz:
```typescript
await supabase.from("lia_attendances").update({ lead_status: newStatus }).eq("id", draggedId);
```

**Apenas atualiza o Supabase. NÃO chama a API do PipeRun para mover o deal.** Qualquer movimentação no Kanban fica dessincronizada do CRM. Isso é bidirecional no papel (`smart-ops-piperun-webhook` + `ETAPA_TO_STAGE` existem) mas o Kanban não usa.

## 4. Plano de Correção

### 4.1 — Fix handleDrop para sincronizar com PipeRun (Prioridade Alta)

Quando o usuário arrasta um card no Kanban:
1. Atualizar `lia_attendances.lead_status` (já faz)
2. Se o lead tem `piperun_id`, chamar PipeRun API para mover o deal para o `stage_id` correspondente usando `ETAPA_TO_STAGE`
3. Usar o endpoint existente `piperun-api-test` com action `raw_put` ou criar uma edge function dedicada `smart-ops-kanban-move`

### 4.2 — Adicionar colunas faltantes ao Kanban (Prioridade Média)

Expandir `CS_COLUMNS` para incluir todas as 15 etapas do CS Onboarding:
- `cs_sem_data_agendar`, `cs_nao_quer_imersao`, `cs_treinamento_agendado`, `cs_treinamento_realizado`, `cs_enviar_imp3d`, `cs_equipamentos_entregues`, `cs_retirar_scan`, `cs_acompanhamento_15d`, `cs_acomp_30d_comercial`, `cs_acompanhamento_atencao`, `cs_finalizado`, `cs_nao_use_dkmngr`, `cs_nao_use_omie_fix`, `cs_auxiliar_email`

Adicionar seção `INSUMOS_COLUMNS` com as 5 etapas.

Corrigir `STATUS_KEYS` para incluir todos os status válidos.

### 4.3 — Mapear pipeline E-commerce (Prioridade Baixa)

Novo pipeline 102702 com 8 etapas. Precisa ser adicionado a `piperun-field-map.ts` e ao Kanban se relevante.

### 4.4 — Ativar sync-piperun como cron (Prioridade Alta)

A função `smart-ops-sync-piperun` existe e funciona mas nunca é executada automaticamente. Precisa de um cron job (a cada 30min) para garantir sincronia contínua além do webhook.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/components/SmartOpsKanban.tsx` | Expandir CS_COLUMNS (2→15 etapas), adicionar INSUMOS_COLUMNS, fix handleDrop para sync PipeRun, incluir todos status em STATUS_KEYS |
| `supabase/functions/_shared/piperun-field-map.ts` | Adicionar pipeline E-commerce (102702) + suas 8 etapas ao STAGE_TO_ETAPA |
| Nova edge function ou reuso de `piperun-api-test` | Endpoint para mover deal no PipeRun quando Kanban drag-drop acontece |

