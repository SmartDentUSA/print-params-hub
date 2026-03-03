

## Plano: Custo por Token + Separação por Provider (DeepSeek vs Gemini)

### Mudanças no `SmartOpsAIUsageDashboard.tsx`

**1. Novo aggregation `byProvider`** — agrupa os dados por `provider` (campo já existente na tabela `ai_token_usage`), calculando tokens, chamadas, custo total e **custo médio por token** (USD e BRL) para cada provider.

**2. Cards de resumo por provider** — adicionar uma seção com 2-3 cards (DeepSeek, Lovable/Gemini, Google/Embeddings) mostrando:
- Total tokens
- Custo total R$
- Custo por 1K tokens (R$) — calculado como `(cost_usd / total_tokens) * 1000 * exchangeRate`

**3. Coluna "R$/1K tok" na tabela por função** — adicionar uma coluna calculada `(cost_usd / total_tokens) * 1000 * exchangeRate` para cada função, dando visibilidade do custo unitário por função.

**4. Card de custo por token no resumo geral** — adicionar um 5o card "Custo/1K Tokens" com a média ponderada global.

### Resultado

| Provider | Tokens | Custo | R$/1K tokens |
|---|---|---|---|
| Lovable (Gemini) | 1.2M | R$ 3,48 | R$ 0,0029 |
| DeepSeek | 300K | R$ 0,49 | R$ 0,0016 |
| Google (Embed) | 500K | R$ 0,06 | R$ 0,0001 |

