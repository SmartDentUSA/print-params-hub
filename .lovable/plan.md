## Objetivo

Adicionar a célula **"Insumos"** na Etapa 7 (Fresagem) do Workflow 7×3, para mapear blocos/discos de zircônia, dissilicato, PMMA, ceras de fresagem etc. — produtos que hoje são identificados nos deals do CRM mas que caem em células erradas (ou ficam fora do mapeamento).

A célula nova fica entre `Software` e `Serviço`:

```text
7 · Fresagem | Equipamentos | Software | Insumos | Serviço | Acessórios | Peças/Partes
```

## O que vai mudar

### 1. Banco (migration)
- `ALTER TABLE lia_attendances ADD COLUMN hits_e7_insumos integer DEFAULT 0` (granular hit counter, idempotente).
- `UPDATE product_taxonomy SET subcategory='insumos' WHERE workflow_stage='etapa_7_fresagem' AND subcategory='insumos_fres'` (alinhar nome com as outras etapas).
- Inserir/expandir `match_patterns` da linha "Insumos de Fresagem" para cobrir o que já vimos no CRM:
  - Blocos de Zircônia Smart Zr (HT, ST, TT White, TT ML, TT GT, Zirkonzahn, Amann)
  - Blocos de Dissilicato de Lítio Evolith CAD 14mm
  - Frese Smart-DLC para Zircônia
  - Berço para Sinterização de Zircônia
  - Spray Revelador para Escaneamento (uso EXTERNO)
  - Base para Pigmentação de Zircônia 50ml/100ml
  - Efeitos para Pigmentação de Zircônia 20ml
  - Fresa para Dissilicato de Lítio
  - PMMA, wax disc, disco fresagem genéricos

### 2. Edge function `backfill-hits-granular`
- Adicionar `hits_e7_insumos` em `ALL_HITS_E_COLS`.
- Adicionar padrões em `PRODUCT_PATTERNS` (regex cobrindo: `bloco|disco|smart\s*zr|smartzr|zircônia|zirconia|dissilicato|evolith|pmma|wax\s*disc|berço.*sinteriza|spray.*revelador|pigmenta(ç|c)ão.*zircônia|frese.*smart.*dlc|fresa.*dissilicato`) → `hits_e7_insumos`.
- Tirar `bloco.*fres|disco.*zircônia|smartzr` do mapeamento atual de `hits_e7_pecas_partes` (estavam classificando insumos como peças).
- Após deploy: chamar a função uma vez para reclassificar os leads existentes (idempotente — zera e recalcula).

### 3. Edge function `smart-ops-leads-api`
- `STAGE_SUBCATEGORIES.etapa_7_fresagem`: incluir `'insumos'`.
- `LEAD_COLUMN_MAP`: adicionar entrada `{ stage: 'etapa_7_fresagem', subcat: 'insumos', layer: 'ativo', col: 'hits_e7_insumos' }`.

### 4. Frontend
- `src/components/smartops/WorkflowPortfolio.tsx` (STAGES → etapa_7_fresagem.cols): inserir `{ field: 'insumos', label: 'Insumos' }` entre `software` e `servico`.
- `src/components/smartops/SmartOpsWorkflowMapper.tsx` (STAGES → etapa_7_fresagem.cols): mesma inclusão.
- `src/components/SmartOpsMappingFieldsEditor.tsx` (`WORKFLOW_CELLS`): adicionar `7_fresagem__insumos` → "7 · Fresagem / Insumos".

### 5. Copilot (referência textual)
- `supabase/functions/smart-ops-copilot/index.ts` linha 1442: incluir `hits_e7_insumos` na lista de hits granulares (nota: o índice agregado `hits_fresagem` continua existindo).

## Fora do escopo
- Não alteramos `hits_fresagem` agregado nem `equip_fresadora` (camadas conc/sdr).
- Não criamos coluna SDR-interesse para "insumos" (não há sinal de captação separado hoje).
- Não mexemos em CRM PipeRun stage mapping (`piperun-field-map.ts`) — é só taxonomia interna.

## Validação
1. Rodar migration.
2. Deploy edge functions (`backfill-hits-granular`, `smart-ops-leads-api`).
3. Invocar `backfill-hits-granular` uma vez.
4. Abrir um lead com deal de "Bloco de Zircônia Smart Zr" no Kanban → verificar célula `7 · Fresagem / Insumos` acesa em verde (ativo).
5. Conferir SmartOpsWorkflowMapper renderizando 6 colunas em Fresagem.
