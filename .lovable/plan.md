## Causa raiz

A função `social-caption-generator` está chamando o **Lovable AI Gateway diretamente** (linha 200-219, hardcoded `gemini-2.5-flash-lite`) e retornando 402 ("Not enough credits"). Não passa pelo `ai-router` que já tem fallback configurado para Poe.

Confirmado em logs:
```
ERROR [caption] LLM error 402 {"type":"payment_required","message":"Not enough credits"}
```

A tabela `ai_model_routing` já tem a rota `social_caption`:
- Primary: `lovable / google/gemini-3-flash-preview`
- Fallback: `poe / gemini-3-flash`

E `POE_API_KEY` já está configurada. Basta migrar a função para usar o router.

## Mudança

**Arquivo único**: `supabase/functions/social-caption-generator/index.ts`

Substituir `callLLM(prompt)` por `aiComplete({ task: "social_caption", ... })`:

```ts
import { aiComplete } from "../_shared/ai-router.ts";

// dentro do handler, no lugar do fetch direto:
const r = await aiComplete({
  task: "social_caption",
  functionName: "social-caption-generator",
  messages: [
    { role: "system", content: "Você devolve SEMPRE JSON válido sem cercas de código." },
    { role: "user", content: prompt },
  ],
  temperature: 0.7,
});
if (!r.ok) throw Object.assign(new Error(r.error || "LLM falhou"), { status: 502 });
// parse r.text como JSON (mesmo bloco try/catch atual)
```

- Remover `LOVABLE_API_KEY` e função `callLLM` direta.
- Manter sanitização de hashtags / caption.
- `_meta.model` passa a refletir `${r.provider_used}/${r.model_used}` (útil para debug do fallback).

## Resultado esperado

Quando Lovable Gateway retornar 402/429/5xx, o router automaticamente cai para Poe (gemini-3-flash) e o usuário não vê erro. Custo: ~$0,30/1M tokens via Poe.

## Fora de escopo

- Não tocar em `useGenerateCaption.ts` nem no `StepContent.tsx` (API contract idêntico).
- Não alterar a tabela `ai_model_routing`.
- Não migrar outras funções nesta tarefa.