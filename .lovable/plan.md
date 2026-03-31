

## Problema: Lead Criado na Etapa Errada do Distribuidor

### Diagnóstico

O `resolveFirstStage` (linha 1391 do `lia-assign`) consulta a API PipeRun buscando stages do pipeline 70898 (Distribuidor de Leads) ordenados por `order ASC` e pega o primeiro. A API está retornando **"Vendas no site"** como primeiro resultado, ao invés de **"0. Distribuidor de leads"**.

Isso acontece porque a API do PipeRun nem sempre respeita o parâmetro `order_by`, ou porque "Vendas no site" tem ordem menor que "0. Distribuidor de leads" na configuração do funil.

### Correção

**Hardcodar o stage ID** da etapa "0. Distribuidor de leads", assim como já fazemos com `STAGES_VENDAS`, `STAGES_ESTAGNADOS`, etc. Isso elimina a dependência da API para resolver o stage correto.

### Mudanças

#### 1. `supabase/functions/_shared/piperun-field-map.ts`
- Adicionar constante `STAGES_DISTRIBUIDOR` com o ID correto da etapa "0. Distribuidor de leads"
- Precisaremos consultar o ID real via API ou o usuário nos informar

#### 2. `supabase/functions/smart-ops-lia-assign/index.ts`
- Substituir a chamada `resolveFirstStage(PIPERUN_API_KEY, PIPELINES.DISTRIBUIDOR_LEADS)` na linha 1130 por `STAGES_DISTRIBUIDOR.ETAPA_0`
- Remover a dependência dinâmica da API

### Informação necessária

Para hardcodar o stage, preciso do **ID numérico** da etapa "0. Distribuidor de leads" no PipeRun. Posso obtê-lo invocando a edge function `piperun-api-test` com endpoint `stages?pipeline_id=70898` para listar todos os stages deste funil e identificar o correto.

### Resultado
- Leads sem vendedor ativo sempre cairão em "0. Distribuidor de leads" (e não "Vendas no site")
- Sem dependência de ordenação da API PipeRun

