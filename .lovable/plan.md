## Diagnóstico

O painel "Funil por Vendedor" mostra dados errados por **3 problemas encadeados**:

1. **`deals.pipeline_name` vazio em 16.633 deals abertos** (15.829 sem texto + 804 com `pipeline_id` preenchido mas nome vazio). O sync `smart-ops-sync-piperun` só grava `pipeline_id`, nunca grava `pipeline_name`.
2. **RPC `fn_relatorio_mes_vendedor_detalhe`** calcula estagnados via `stage_name ILIKE '%estagnad%'` — nenhum stage tem essa palavra inteira (são `"- Estag"`, `"Reativação"`). Resultado: **Estagnados = 0** para todos.
3. **RPC `fn_relatorio_mes_funil_atual`** devolve `funil = '—'` para os deals sem `pipeline_name`. O frontend filtra só `funil contém "estagnados"`, então essas linhas estagnadas vão parar no agregado **"Funil vendas"** (inflando para 2.245, 2.094 etc).

Regras confirmadas com o usuário:
- **Classificação = pipeline atual do PipeRun** (não inferir por stage).
- **Escopo do card** = pipelines `'Funil de vendas'` + `'Funil Estagnados'`. Os demais (CS Onboarding, Distribuidor de Leads, Exportação, E-book etc.) saem.

## Mudanças

### 1. Backfill de `deals.pipeline_name` e `pipeline_id` (via `supabase--insert`)
Dois UPDATEs idempotentes:
- **A)** Para cada `pipeline_id`, usa o nome canônico (modo estatístico das linhas que já têm nome) e preenche/sobrescreve `pipeline_name` quando vazio ou divergente.
- **B)** Para deals com `pipeline_id IS NULL`, deriva `pipeline_id`+`pipeline_name` a partir do `stage_id` (modo das linhas onde stage_id já mapeia para um pipeline conhecido).
  - Cobre os ~13k deals com `stage_id` preenchido (542161, 447251, 447252, 542160 = Funil Estagnados).
  - Os deals com `stage_id IS NULL` (~2k) ficam para o re-sync via PipeRun fazer.

### 2. Migração: `fn_relatorio_mes_vendedor_detalhe`
- Restringir `deals_filt` para `pipeline_name IN ('Funil de vendas','Funil Estagnados')`.
- `estagnados_coorte`: trocar `stage_name ILIKE '%estagnad%'` por `pipeline_name = 'Funil Estagnados'`.
- `abertas_snap`: passa a refletir apenas Vendas+Estagnados (coerente com o card).

### 3. Migração: `fn_relatorio_mes_funil_atual`
- Restringir o `SELECT` a `pipeline_name IN ('Funil de vendas','Funil Estagnados')`.
- Elimina linhas com `funil = '—'`, então o filtro do frontend (`includes('estagnados')`) volta a funcionar corretamente.

### 4. Edge function `smart-ops-sync-piperun`
- Adicionar mapa local `PIPELINE_NAMES: Record<number,string>` (`18784→'Funil de vendas'`, `72938→'Funil Estagnados'`, `83896→'CS Onboarding'`, `82128→'Funil E-book'`, `73999→'Funil Atos'`, `83813→'Tulip-Teste-Nv-Automação'`, `70898→'Distribuidor de Leads'`, `39047→'Exportação'`, `100412→'Funil Insumos'`, `102893→'Ganhos Aleatórios (CS)'`).
- Onde grava o deal (linhas ~392, ~439, ~876), adicionar `pipeline_name: deal.pipeline?.name ?? PIPELINE_NAMES[pipelineId] ?? null`. Previne reaparecimento do bug.

### Verificação final
```sql
SELECT pipeline_name, COUNT(*) FROM deals
 WHERE COALESCE(is_deleted,false)=false AND status='aberta' GROUP BY 1;
SELECT * FROM fn_relatorio_mes_vendedor_detalhe(2026,6) ORDER BY estagnados DESC LIMIT 10;
```
Esperado: `(vazio)` cai de 15.829 para ≲ 2.000, e `estagnados` > 0 para os vendedores ativos.

## O que NÃO mexer
- Frontend `RelatorioMensalComercial.tsx` permanece como está (o filtro `includes('estagnados')` passa a funcionar correto após RPC corrigida).
- Nenhuma mudança em `lia_attendances`, `piperun_staging`, ou outras integrações.
- Não fazer DELETE em deals — backfill só preenche colunas vazias/divergentes.
