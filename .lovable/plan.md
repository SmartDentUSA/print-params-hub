

## Diagnóstico: Por que o Funil de Vendas não está sincronizado

### Problemas identificados

**1. Sync busca apenas 300 deals (3 páginas) sem filtrar por pipeline**
O sync incremental busca as últimas 300 deals modificadas em **todos** os pipelines. Como o Funil Estagnados tem muito mais movimentação, ele domina os resultados: 848 leads de Estagnados vs apenas 21 de Vendas. Deals do Funil de Vendas simplesmente não aparecem nas 3 páginas.

**2. 203 deals ignorados por falta de email/nome**
Muitos deals têm `reference=null` (sem email) e nome no formato "Nome - timestamp - Nova Interação", que não é limpo. Sem email, o sistema não consegue vincular nem criar o lead.

**3. Stage IDs não mapeados (535465, 523977)**
36 leads têm IDs numéricos brutos em `ultima_etapa_comercial` em vez de labels legíveis. Esses IDs (535465=EM_ESPERA, 523977=SEM_DATA_AGENDAR do CS Onboarding) estão no mapa de stages mas foram gravados antes da correção.

### Plano de Correção

#### 1. Sync por pipeline individual
Alterar `smart-ops-sync-piperun` para aceitar `?pipeline_id=18784` (Vendas) e iterar separadamente por pipeline. Em modo full, sincronizar cada pipeline relevante (Vendas, Estagnados, CS Onboarding, Insumos).

```text
Antes:  GET /deals?show=100&page=1  (todos os pipelines misturados)
Depois: GET /deals?show=100&page=1&pipeline_id=18784  (Vendas)
        GET /deals?show=100&page=1&pipeline_id=72938  (Estagnados)
        GET /deals?show=100&page=1&pipeline_id=83896  (CS Onboarding)
```

#### 2. Extrair nome limpo do título do deal
Tratar títulos com formato "Nome - timestamp - Nova Interação" para extrair apenas o nome real antes do primeiro " - ".

#### 3. Corrigir 36 registros com stage IDs brutos
Rodar um UPDATE pontual para converter `535465` → `cs_em_espera` e `523977` → `cs_sem_data_agendar` no `ultima_etapa_comercial`.

#### 4. Aumentar maxPages no sync incremental
De 3 para 10 páginas (1000 deals) no modo incremental para cobrir mais pipelines.

### Arquivos afetados
- `supabase/functions/smart-ops-sync-piperun/index.ts` — filtro por pipeline, limpeza de nome, mais páginas
- `supabase/functions/_shared/piperun-field-map.ts` — adicionar mapeamentos de stage faltantes para CS Onboarding
- Migration SQL — fix dos 36 registros com IDs brutos

