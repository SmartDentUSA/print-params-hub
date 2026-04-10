

## Copilot Comercial — Nova Tool + System Prompt

### Resumo
Adicionar ferramenta `query_sales_summary` e substituir o system prompt inteiro pelo novo prompt de Gerente Comercial fornecido pelo usuário.

### Mudanças em `supabase/functions/smart-ops-copilot/index.ts`

#### 1. Nova tool definition (após linha 498, antes do `];`)

```typescript
{
  type: "function",
  function: {
    name: "query_sales_summary",
    description: "Retorna total de vendas e ranking de vendedores de um mês via funções SQL consolidadas. USE SEMPRE para faturamento, receita, total de vendas, ranking. NUNCA use query_deal_history ou PipeRun API para totais.",
    parameters: {
      type: "object",
      properties: {
        ano: { type: "number", description: "Ano (padrão: ano atual)" },
        mes: { type: "number", description: "Mês 1-12 (padrão: mês atual)" },
        include_ranking: { type: "boolean", description: "Se true, inclui ranking por vendedor (padrão true)" }
      },
      required: []
    }
  }
}
```

#### 2. Nova executor function (antes do `toolExecutors`, ~linha 1266)

```typescript
async function executeQuerySalesSummary(args: any) {
  try {
    const now = new Date();
    const ano = args.ano || now.getFullYear();
    const mes = args.mes || (now.getMonth() + 1);

    const { data: totals, error: totErr } = await supabase.rpc("fn_total_vendas_mes", { p_ano: ano, p_mes: mes });
    if (totErr) return { error: totErr.message };

    const result: any = { periodo: `${mes}/${ano}`, totals: totals?.[0] || null };

    if (args.include_ranking !== false) {
      const { data: ranking, error: rankErr } = await supabase.rpc("fn_resumo_vendas_mes", { p_ano: ano, p_mes: mes });
      if (rankErr) return { error: rankErr.message };
      result.ranking = ranking;
    }

    return result;
  } catch (e) {
    return { error: e.message };
  }
}
```

#### 3. Registrar no `toolExecutors` (linha 1296)

Adicionar: `query_sales_summary: executeQuerySalesSummary,`

#### 4. Substituir SYSTEM_PROMPT completo (linhas 1298-1472)

Substituir pelo novo prompt fornecido pelo usuário que inclui:
- Identidade de Gerente Comercial
- 6 capacidades principais
- Mapa de dados completo com campos de `lia_attendances`
- Regras de vendas com funções SQL obrigatórias
- Regras de campanha, oportunidades, comportamento
- Workflow de campanha passo a passo
- Regras de comportamento e formato de resposta
- Tabela de referência rápida de fontes de dados
- Dados de referência: Abril 2026 até 09/04: R$ 440.329,19

O prompt existente de ~170 linhas será substituído pelo novo prompt de ~400 linhas.

### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-copilot/index.ts` | +1 tool def, +1 executor, +1 entry no map, system prompt substituído |

### Validação pós-deploy

Testar via `curl_edge_functions` com:
1. "Qual o total de vendas deste mês?" → espera ~R$ 440k
2. "Ranking de vendedores abril" → Lucas Silva em 1º
3. "Compare março e abril" → deve chamar a função 2x

