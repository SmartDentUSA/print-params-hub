

# Copilot IA — Dual Brain: DeepSeek + Gemini

## Problema atual
O Copilot usa apenas DeepSeek. Quando atinge o limite de iterações (5), retorna "Operação concluída após múltiplas etapas" sem conteúdo útil. Além disso, faz uma chamada duplicada ao DeepSeek para streaming quando já tem a resposta.

## Solução
Adicionar Gemini (`google/gemini-3-flash-preview`) como segundo cérebro via Lovable AI Gateway, com seleção automática ou manual do modelo. Também corrigir os bugs existentes.

### Mudanças na Edge Function `smart-ops-copilot`

1. **Dual model support**: Aceitar `{ model?: "deepseek" | "gemini" }` no body. Default: `deepseek`.
2. **Gemini via Lovable Gateway**: Usar `LOVABLE_API_KEY` + `https://ai.gateway.lovable.dev/v1/chat/completions` com model `google/gemini-3-flash-preview` e tool calling.
3. **Aumentar `maxIterations` de 5 para 10**.
4. **Eliminar chamada duplicada**: Quando o modelo retorna texto sem tool calls, usar `choice.message.content` direto (simular SSE no servidor para manter compatibilidade com frontend).
5. **Fallback inteligente**: Se atingir limite de iterações, fazer uma última chamada ao modelo pedindo para resumir os tool results acumulados.
6. **Log de usage**: Registrar tokens via `logAIUsage`.

### Mudanças no Frontend `SmartOpsCopilot.tsx`

1. **Seletor de modelo**: Toggle entre "DeepSeek" e "Gemini" no header do chat (Badge clicável).
2. **Enviar `model` no body** da requisição.
3. **Indicador visual**: Mostrar qual modelo está ativo.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/smart-ops-copilot/index.ts` | **Reescrever** — dual model, fix bugs, Lovable Gateway |
| `src/components/SmartOpsCopilot.tsx` | **Editar** — seletor de modelo |

