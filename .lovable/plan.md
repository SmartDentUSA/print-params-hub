## Problema

A RPC `fn_relatorio_mes_vendedor_detalhe` está usando a coorte de criação (`piperun_created_at no mês`) como base para todas as colunas — abertas, perdidas, ganhas e estagnados. Isso filtra demais e os números ficam errados.

## Definições corretas (confirmadas)

- **Abertos da Coorte** → snapshot: deals que estavam abertos em **algum momento do mês selecionado** (criados antes do fim do mês E ainda sem fechamento OU fechados após o início do mês).
- **Enviados para Estagnados** → deals **criados no mês** que **hoje** estão em `stage_name ILIKE '%estagnad%'`.
- **Perdidas / Ganhas** → filtradas pela **data de fechamento (`closed_at`) no mês**, independente da data de criação.

## Mudanças

### 1. Migration: substituir `fn_relatorio_mes_vendedor_detalhe`

Recriar a função com 4 CTEs independentes (uma por coluna), todas agrupadas por `owner_name`:

```text
abertos_snapshot:
  WHERE is_deleted=false
    AND piperun_created_at < (mes + 1)
    AND (closed_at IS NULL OR closed_at >= mes)
    AND status NOT IN ('won','lost')  -- opcional; snapshot pura ignora status

estagnados_coorte:
  WHERE is_deleted=false
    AND piperun_created_at >= mes AND piperun_created_at < mes+1
    AND stage_name ILIKE '%estagnad%'

perdidas_mes:
  WHERE is_deleted=false
    AND status='lost'
    AND closed_at >= mes AND closed_at < mes+1

ganhas_mes:
  WHERE is_deleted=false
    AND status='won'
    AND closed_at >= mes AND closed_at < mes+1
```

FULL OUTER JOIN por `owner_name`, retornando `(vendedor, abertos, estagnados, perdidas, ganhas)`. Excluir owners nulos/numéricos.

### 2. Ajustar `fn_relatorio_mes_kpis` e `fn_relatorio_mes_funil_estagnados`

Aplicar a mesma semântica consistente:
- `funil_ativo` (KPI global) = abertos snapshot do mês (não só coorte criada no mês).
- `enviados_estagnados` (KPI global) = criados no mês + hoje em Estagnados (mantém).
- `perdidas_mes` (KPI global) = `status='lost' AND closed_at no mês` (mantém).

### 3. Frontend (`RelatorioMensalComercial.tsx`)

Atualizar o subtítulo do card para refletir a nova definição:
> "Abertos (snapshot do mês) · Enviados para Estagnados (criados no mês) · Perdidas/Ganhas (fechadas no mês)"

Sem mudança de layout — só labels e os números virão corrigidos pela RPC.

## Não muda

- Estrutura visual dos cards por vendedor.
- Demais seções (Produtos, Recorrência, Astron, KPIs gerais de receita).
- Tipos do Supabase só serão regenerados se a assinatura da RPC mudar (vamos manter as colunas: `vendedor, abertos, estagnados, perdidas, ganhas`).
