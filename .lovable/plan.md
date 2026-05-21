# Diagnóstico

## 1) Card da Caroline mostra "BLZ Dental INO200" + "RAYSHAPE", mas nos deals ganhos só há resinas

**Causa raiz (confirmada no banco):** o lead `45f16554-…-2538d2e` recebeu esses valores **via formulário** "# - Formulário exocad I.A." em 20/04/2026. No `lead_enrichment_audit.new_values` está:
- `equip_scanner = "BLZ Dental INO200"` ← resposta da pergunta *"Hoje você digitaliza suas moldagens?"*
- `impressora_modelo = "RAYSHAPE"` ← resposta da pergunta *"Atualmente você utiliza qual impressora?"*

Os `deal_items` (PipeRun) só têm resinas/SmartMake. Ou seja: **os equipamentos NÃO vieram de venda nossa — vieram do que a própria lead declarou no form**. Hoje o card não diferencia visualmente "equipamento que a Smart Dent vendeu" de "equipamento que a lead já tinha e declarou no form".

## 2) Cards tipo "Leandro Augusto Guimarães · 469 deals · R$1.081.384" e "Nome não informado · 312 deals · R$1.1M Manaus AM"

**Causa raiz (confirmada):**
- `b5494221-…-2dda146b9c1`: `nome = "C E L ODONTOLOGIA LTDA"`, `omie_razao_social = "UP PROTESES DIGITAL MANAUS LTDA"`, `piperun_deals_history` tem **469 entradas**, `omie_faturamento_total = 0`, email = `"e-mail não informado"`.
- `c8fc74f6-…`: `Felipe Andrade Silva` com **493 deals**, `email = "sem-email@gasparini.placeholder"`, omie_faturamento_total = 0.

Dois problemas convivem aqui:
1. **Identidade poluída**: o nome do card vem de pessoa física (Leandro) ou está vazio/placeholder, enquanto a razão social Omie é outra empresa (UP PROTESES DIGITAL MANAUS). A regra "Person Origin & Company-Like Names" detecta razão social, mas não está promovendo a `omie_razao_social` quando o `nome` está ausente ou é placeholder.
2. **Contagem inflada de deals**: 469/493 entradas em `piperun_deals_history` para um único lead canônico não é normal — provavelmente:
   - merges agregaram histórico de várias pessoas dentro do mesmo CNPJ (legítimo), **ou**
   - re-entregas/duplicatas PipeRun não dedupadas pela chave correta (`deal_id` PipeRun).

# Plano

## Etapa 1 — Diferenciar "equipamento declarado" vs "equipamento comprado" no card do lead

**Frontend (`KanbanLeadDetail` / aba "Histórico Completo" / seção de equipamentos):**
- Para cada equipamento exibido (`equip_scanner`, `impressora_modelo`, `equip_cad`, etc.), buscar a fonte mais recente em `lead_enrichment_audit`:
  - `source IN ('form', 'sdr_captacao', 'astron_*')` → badge cinza **"declarado pelo lead"** + tooltip com o nome do form.
  - `source IN ('backfill_equipment_from_deals', 'piperun_deal_items')` → badge verde **"Smart Dent (venda)"** + link para o deal.
  - Sem auditoria → badge âmbar **"origem desconhecida"**.
- Acrescentar linha pequena abaixo do equipamento: *"Declarado em '# - Formulário exocad I.A.' em 20/04/2026"*.

**Por quê:** elimina a confusão da Caroline. O dado está correto, só faltava contexto visual.

## Etapa 2 — Card com nome vazio/PF quando há razão social Omie

**Backend (trigger ou função RPC que monta o card):**
- Quando `nome` for `NULL`/vazio/`"Nome não informado"`/`"sem-nome"` **e** `omie_razao_social` existir, exibir título do card como `omie_razao_social` (CNPJ).
- Quando `nome` for pessoa física **mas** `omie_razao_social` for diferente, exibir os dois: `"Leandro Augusto Guimarães · UP PROTESES DIGITAL MANAUS LTDA"`.
- Email/telefone placeholder (`"e-mail não informado"`, `"sem-email@*.placeholder"`, `"gmail.com"` puro) deve renderizar "—" em vez do placeholder bruto.

## Etapa 3 — Auditoria da contagem de deals (469/493/312)

**Investigação primeiro (SQL one-shot, sem migration):**
- Para cada um dos 5 leads com `deals_count > 80`, agrupar `piperun_deals_history` por `deal_id` e contar duplicatas.
- Se houver duplicatas: aplicar dedupe por `deal_id` no JSONB (cobre cenário re-entrega que a memória `meta-redelivery-loop-fix` cobre para Meta, mas não para PipeRun history).
- Se NÃO houver duplicatas: validar se merge incremental está copiando o array inteiro a cada execução em vez de fazer union — checar `mem://smart-ops/lead-merge-system-v2`.

**Fix (depende do resultado):**
- Migration de limpeza dedupando por `deal_id` em `piperun_deals_history` dos leads afetados.
- Adicionar guard no merge: ao concatenar histórico, fazer union pela chave `deal_id`.

## Etapa 4 — Métricas financeiras zero apesar de 469 deals

`omie_faturamento_total = 0` com 469 deals PipeRun ganhos: o `omie_codigo_cliente` provavelmente não está mapeado para esses CNPJs. Disparar `smart-ops-omie-sync` filtrado por CNPJ desses 5 leads para reconciliar o faturamento real e validar a regra `Max(CRM_Won, Omie_Billing) + LTV_Ecommerce`.

# Detalhes técnicos

- **Arquivos a tocar (Etapa 1):**
  - `src/components/smartops/KanbanLeadDetail.tsx` (seção de equipamentos)
  - Novo hook `useEquipmentProvenance(leadId)` consultando `lead_enrichment_audit` com filtro por `fields_updated && '{equip_scanner,impressora_modelo,...}'`.

- **Arquivos a tocar (Etapa 2):**
  - `src/components/smartops/KanbanLeadCard.tsx` (título do card)
  - `src/components/leads/*` (badges B2B/CNPJ)
  - Função `resolveLeadDisplayName(lead)` em `src/utils/leadParsers.ts`.

- **Arquivos a investigar (Etapa 3):**
  - `supabase/functions/smart-ops-lia-assign/index.ts` (onde `piperun_deals_history` é atualizado).
  - `supabase/functions/smart-ops-lead-merge/*` (concatenação no merge).

- **Não tocar:** lógica de ingestão de form (`smart-ops-ingest-lead`) — a captura está correta; o problema é só apresentação.

# Ordem de execução

1. Confirmar com você que a Etapa 1 (badges de proveniência) é suficiente para o caso Caroline, ou se prefere **suprimir** equipamento declarado quando não houver venda correspondente (mais agressivo).
2. Rodar SQL diagnóstico da Etapa 3 antes de qualquer migration.
3. Implementar Etapas 1 + 2 (frontend puro, baixo risco).
4. Implementar Etapa 3 (migration) só depois do diagnóstico.
5. Etapa 4 (Omie reconcile) pode rodar em paralelo.
