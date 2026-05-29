## Objetivo

1. Painel Administrativo (`SmartOpsAIUsageDashboard`) passa a exibir consumo do **Claude** (Anthropic) ao lado de Lovable/DeepSeek/Google.
2. Seletor de modelo do Copilot ganha duas variantes do DeepSeek: **DeepSeek-V4-Pro** e **DeepSeek-V4-Flash** (substituindo o botão único "DeepSeek").

## Mudanças

### 1. Tracking de uso do Claude
`supabase/functions/_shared/log-ai-usage.ts`
- Adicionar `"anthropic"` em `COST_RATES` (ex.: Claude Sonnet 4.5 ≈ $3 input / $15 output por 1M tokens).
- `detectProvider()`: retornar `"anthropic"` quando o model contém `claude` ou começa com `anthropic/`.

`supabase/functions/smart-ops-copilot/index.ts`
- Já chama `logAIUsage` — passará a registrar o provider `anthropic` automaticamente assim que o detector for atualizado.

### 2. Painel admin reconhece Claude
`src/components/SmartOpsAIUsageDashboard.tsx`
- `PROVIDER_LABELS`: adicionar `anthropic: "Anthropic (Claude)"`.
- `PROVIDER_COLORS`: adicionar `anthropic: "text-purple-600"`.
- Ajustar grid de provider breakdown de `sm:grid-cols-3` → `sm:grid-cols-4` para acomodar Anthropic.
- `AI_FUNCTIONS_MAP["smart-ops-copilot"]`: registrar entrada do Copilot com provider `"Lovable + DeepSeek + Anthropic"` (a função não estava listada).

### 3. Variantes DeepSeek no Copilot
`supabase/functions/smart-ops-copilot/index.ts`
- `ModelId` passa a aceitar `"deepseek-pro"` e `"deepseek-flash"` (mantém `"deepseek"` como alias legado → mapeia para `deepseek-pro`).
- `getModelConfig()`:
  - `deepseek-pro` → `model: "deepseek-chat"`, label `deepseek-pro`
  - `deepseek-flash` → `model: "deepseek-chat"` com prompt/temperatura otimizada **ou** `model: "deepseek-reasoner"` (a decidir — ver pergunta abaixo)
- Roteamento de `requestedModel` no handler ajustado para os novos IDs.

`src/components/SmartOpsCopilot.tsx`
- `ModelId`: `"deepseek-pro" | "deepseek-flash" | "gemini" | "claude"`.
- Substituir o `ToggleGroupItem value="deepseek"` por dois itens: **DS V4-Pro** e **DS V4-Flash**.
- Default selecionado: `deepseek-pro`.
- Persistir seleção em `localStorage` (atualmente não persiste).

## Detalhes técnicos

```text
ai_token_usage.provider passa a ter 4 valores possíveis:
  lovable | deepseek | google | anthropic
```

Custos estimados (USD/1M tokens) usados em `log-ai-usage.ts`:
```
anthropic (Claude Sonnet 4.5): input 3.00 / output 15.00
```

## Pergunta antes de implementar

DeepSeek API hoje expõe apenas dois modelos públicos: `deepseek-chat` (V3.2) e `deepseek-reasoner`. Os nomes "V4-Pro" e "V4-Flash" não existem no endpoint oficial. Para o seletor funcionar de verdade, preciso saber como mapear:

- **Opção A** (recomendada): `V4-Pro` → `deepseek-chat`, `V4-Flash` → `deepseek-reasoner` (raciocínio mais longo).
- **Opção B**: ambos chamam `deepseek-chat` e a diferença é só `temperature`/`max_tokens` (Pro = qualidade, Flash = rápido/curto).
- **Opção C**: você tem acesso a um endpoint/beta com esses model IDs exatos — me passa a string que vai em `body.model`.

Confirmar qual opção seguir; se não responder, sigo com **Opção B** (rotulagem visual, mesmo endpoint, parâmetros distintos).
