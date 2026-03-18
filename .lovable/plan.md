

# Correção: Números do Card Divergem do PipeRun

## Diagnóstico Confirmado

Comparação direta Paulo Salles — PipeRun vs SmartOps:

| Métrica | PipeRun (real) | SmartOps (atual) | Problema |
|---------|---------------|------------------|----------|
| LTV ganho | **R$ 19.438,40** | R$ 13.870,40 | JSONB incompleto + `ltv_total` stale |
| Deals ganhos | **19** | ~7 (tabela `deals`) | Sync não populou todos os deals |
| Propostas aprovadas | **19** | Mostra contagem mas de array incompleto |
| Produtos top | Resina Salmão 8un, Bite Splint 8un... | **Não existe** no card |
| Vendedor top | Evandro R$11.356, Patricia R$7.056 | **Não existe** no card |
| Oport. perdidas | **0** | Mostra mas do array incompleto |

**Causa raiz**: O `piperun_deals_history` JSONB e a tabela `deals` estão incompletos — contêm apenas os deals capturados nos últimos syncs, não os 19 históricos. O `ltv_total` na coluna do lead (R$ 13.870) é um valor stale que nunca foi recalculado.

## Plano de Correção (3 etapas)

### Etapa 1: Recalcular LTV e contadores a partir do JSONB (API)

**Arquivo**: `supabase/functions/smart-ops-leads-api/index.ts`

O backend já tenta computar LTV dos deals (linhas 112-119), mas usa a tabela `deals` como fonte e só preenche quando `lead.ltv_total` é falsy. Problema: `ltv_total=13870.4` não é falsy, então o valor stale é mantido.

**Correção**: Sempre recalcular LTV a partir do `piperun_deals_history` JSONB (fonte mais completa), ignorando o campo `ltv_total` da coluna:

```ts
// Substituir linhas 99-119
const jsonbDeals = (lead.piperun_deals_history as any[]) || [];
const tableDeals = (deals || []).map(d => ({...})); // manter mapeamento atual

// Usar a fonte com mais deals
const allDealsList = jsonbDeals.length >= (deals || []).length ? jsonbDeals : tableDeals;
lead.piperun_deals_history = allDealsList;

// Recalcular LTV e contadores SEMPRE a partir dos deals
const wonDealsList = allDealsList.filter(d => 
  ['ganha', 'won', 'Ganha'].includes(d.status || d.situacao || '')
);
lead.ltv_total = wonDealsList.reduce((s, d) => s + (Number(d.value) || 0), 0);
lead.total_deals = wonDealsList.length;
```

### Etapa 2: Adicionar seções "Produtos mais vendidos" e "Vendedor top" ao card

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

**2a) Agregação de produtos por nome/quantidade** (similar ao PipeRun):
- Iterar por todos os deals ganhos → proposals → items
- Agregar por nome do produto: total de unidades e valor total
- Exibir top 5 em tabela na aba Histórico

**2b) Agregação de vendedores**:
- Iterar por deals ganhos, agregar por `owner_name`
- Somar valor total por vendedor
- Exibir top 3 em mini-tabela

**2c) Corrigir contadores no stats row**:
- `wonDeals.length` → calcular a partir do array completo (já funciona se Etapa 1 corrigir a fonte)
- Adicionar "Propostas aprovadas" = propostas dentro de deals ganhos
- Adicionar "Oport. perdidas" explicitamente

### Etapa 3: Garantir que o sync completo capture todos os deals históricos

**Arquivo**: `supabase/functions/piperun-full-sync/index.ts`

O sync atual filtra por `pipeline_id` e faz paginação. O problema é que os 19 deals do Paulo estão no pipeline "Ganhos Aleatórios" que pode não estar na lista `SYNC_PIPELINES` do `smart-ops-sync-piperun`.

**Correção**: Verificar que `PIPELINES.GANHOS_ALEATORIOS` (ou equivalente) está incluído na lista de pipelines sincronizados. Se não existir como constante, adicionar ao mapa de pipelines.

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `smart-ops-leads-api/index.ts` | Recalcular LTV/total_deals do JSONB history (fonte mais completa), não confiar em coluna stale |
| `LeadDetailPanel.tsx` | Adicionar "Produtos mais vendidos" (nome + qtd + valor), "Vendedor top" (nome + valor), corrigir contadores |
| `_shared/piperun-field-map.ts` | Verificar/adicionar pipeline "Ganhos Aleatórios" ao mapa `PIPELINES` |
| `smart-ops-sync-piperun/index.ts` | Adicionar pipeline "Ganhos Aleatórios" ao `SYNC_PIPELINES` |

