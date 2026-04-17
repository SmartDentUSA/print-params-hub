

## Diagnóstico da Alucinação do Copilot

O Copilot está inventando produtos **concorrentes** (Formlabs Form 3B+, Asiga MAX UV, iTero Element 5D, Exocad DentalCAD, Medit T310) como se fossem vendidos pela SmartDent. **Esses produtos NÃO existem no catálogo SmartDent** — são equipamentos da concorrência usados nos campos `equip_*` para detectar oportunidades de migração.

### Causa Raiz

1. **Falta de tool para "produtos vendidos"**: O Copilot tem `query_sales_summary` (totais e ranking de vendedores) e `query_deal_history` (busca por status), mas **nenhuma ferramenta retorna agregação de produtos vendidos no mês**. Quando perguntado, ele alucina baseado no contexto do prompt (que cita Medit, Asiga, Exocad como concorrentes).

2. **Funções SQL prontas e não expostas**: O banco já tem 4 funções perfeitas que NUNCA foram conectadas ao Copilot:
   - `fn_mix_produtos_mes(ano, mes)` — produtos vendidos no mês (Omie ERP). **Validei: retorna dados reais** (BLZ INO200 R$715K, Rayshape Edge Mini R$202K, Smart Print Vitality R$88K).
   - `fn_vendas_produto(busca, inicio, fim)` — busca vendas por produto.
   - `fn_resumo_familias(inicio, fim)` — agregação por categoria.
   - `fn_list_proposal_products()` — lista nomes canônicos de produtos.

3. **Prompt não proíbe alucinação de produtos**: O system prompt instrui sobre receita (`query_sales_summary`), mas não tem regra contra inventar nomes de produtos.

### Dados Reais de Abril 2026 (validados via SQL)

| Produto | Qtd | Receita |
|---|---|---|
| Scanner BLZ INO200 | 16 | R$ 715.725 |
| Scanner I600 | 4 | R$ 250.990 |
| Impressora Rayshape Edge Mini | 15 | R$ 202.900 |
| Scanner BLZ LS100 | 10 | R$ 122.228 |
| Notebook Avell A50 | 15 | R$ 116.000 |
| Resina Smart Print Vitality B1 | 53 | R$ 88.413 |

## Plano de Correção

### Arquivo: `supabase/functions/smart-ops-copilot/index.ts`

**1. Adicionar 2 novas tools:**

- **`query_product_mix`** → invoca `fn_mix_produtos_mes(ano, mes)`. Retorna mix de produtos vendidos no mês com qtd, receita, ticket médio e categoria. Usado para "quais produtos foram vendidos", "top produtos do mês", "mix de vendas".

- **`query_product_sales`** → invoca `fn_vendas_produto(busca, inicio, fim)`. Busca vendas de um produto específico ou família. Usado para "quanto vendi de Vitality", "vendas de scanners".

**2. Atualizar tool descriptions de `query_sales_summary` e `query_deal_history`:**

Adicionar instrução explícita: *"Para LISTAR produtos vendidos use `query_product_mix`. NUNCA invente nomes de produtos."*

**3. Adicionar guarda anti-alucinação no system prompt** (linha ~1342):

```
REGRA CRÍTICA — PRODUTOS:
- NUNCA invente nomes de produtos. Sempre consulte query_product_mix ou query_product_sales.
- Catálogo SmartDent inclui: BLZ INO200/INO100/LS100, Scanner I600/I700, Rayshape Edge Mini, Smart Print (Vitality, Bite Splint Flex, Modelo DLP), NanoClean, Smartmake, SmartGum, Wash & Cure Elegoo, Cura Rayshape ShapeCure.
- Marcas como Formlabs, Asiga, iTero, Exocad, 3Shape, Phrozen, Anycubic são CONCORRENTES detectados em campos equip_*, NUNCA produtos vendidos.
- Se query_product_mix retornar vazio, diga "Não há dados de vendas no período" — NÃO invente.
```

**4. Registrar executors no `toolExecutors`** (linha ~1307).

## Arquivo Afetado

- `supabase/functions/smart-ops-copilot/index.ts` (1 arquivo)

## Resultado Esperado

Copilot passará a responder com produtos reais do catálogo SmartDent (BLZ INO200, Rayshape Edge Mini, Smart Print Vitality) ao invés de inventar Formlabs/Asiga/iTero.

