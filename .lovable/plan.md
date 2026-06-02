## Diagnóstico

O Copilot tem **3 provedores configurados** (`DEEPSEEK_API_KEY`, `LOVABLE_API_KEY/Gemini`, `ANTHROPIC_API_KEY/Claude`), mas o código usa **apenas o que o usuário pediu** (default `deepseek-pro`). Quando esse provedor retorna 402 (`insufficient_credits`), a função para e devolve a mensagem de erro — não tenta os outros.

A solução é trocar a chamada única por uma **cascata automática**: tenta o modelo solicitado e, se ele falhar por falta de crédito, escalona para o próximo provedor com chave configurada.

## Plano

### 1. Helper `runWithFallback` em `supabase/functions/smart-ops-copilot/index.ts`

Substituir as duas chamadas a `fetch(config.url, …)` (loop principal linha ~2559 e summary linha ~2710) por uma função utilitária que percorre uma cadeia de provedores até obter sucesso:

```ts
async function callWithFallback(payload, requestedModelId): Promise<{ response, configUsed, attempts }>
```

**Ordem da cascata** (pula automaticamente o provedor sem API key):
1. Modelo pedido pelo usuário (preserva preferência).
2. `deepseek-pro` (raciocínio + tools).
3. `claude` (Anthropic — só se a key existir).
4. `gemini-flash` (Lovable Gateway — barato).

Sem duplicar o `requestedModelId` na cadeia.

### 2. Critério de "sem crédito"

Considerar o provedor esgotado e pular para o próximo quando:
- HTTP `402`, **OU**
- HTTP `401/403` com body contendo `insufficient`, `balance`, `credit`, `quota`, `billing`, **OU**
- HTTP `400` da Anthropic com `error.type === "billing_error"` (padrão deles).

Demais erros (rate limit `429`, 5xx, schema inválido) **não** disparam fallback — retornam como hoje, para não mascarar bugs reais.

### 3. Resposta ao usuário

Quando o fallback for acionado:
- Logar em `system_health_logs` cada tentativa (provider, status, motivo).
- Prefixar a primeira resposta do turno com badge discreta:
  `> 🔄 _Provedor primário sem créditos — respondi via **{label}**._`
  (apenas na primeira mensagem do turno; nas demais iterações silencioso).

### 4. Mensagem de exaustão total

Se **todos** os provedores da cascata estiverem sem crédito, retornar:
```
💳 Todos os provedores de IA configurados estão sem créditos no momento.
Recarregue um destes: Lovable AI (Gemini), DeepSeek ou Anthropic.
```
com `error: "all_providers_exhausted"`.

### 5. Tracking

- `logAIUsage` passa a receber `modelId` efetivo (não o requested), para o painel mostrar quem realmente respondeu.
- `executedActions` e o restante do loop continuam usando `config` atualizado, sem mudança de contrato.

## Fora de escopo

- Não muda contrato da request/response do frontend.
- Não cria UI de seleção manual (o dropdown atual continua funcionando).
- Não mexe em Dra. LIA, lia-assign, ou qualquer outro agente — só o `smart-ops-copilot`.
- Não tenta provisionar/comprar créditos automaticamente.

## Arquivos a alterar

- `supabase/functions/smart-ops-copilot/index.ts` (apenas).
