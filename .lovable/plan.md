## Diagnóstico

Pico de 29/05 (US$ 5,30) foi causado por **10 chamadas do Copilot no Claude Sonnet 4.5 = US$ 4,86**. Hoje o seletor expõe Claude como opção e qualquer turno carrega Cérebro inteiro + tools (~150k tokens × US$ 15/M output).

Dias "normais" (US$ 0,15–0,50) são dominados por:
- `smart-ops-lia-assign` — 1147 briefings/dia em DeepSeek (volume alto, prompt simples — Gemini Flash-Lite faria igual por 1/14 do preço)
- Copilot em DeepSeek (~US$ 0,30/dia, ok)
- Dra. LIA em Gemini Flash (ok)

## Rebalanceamento por tarefa (cada IA no que faz melhor)

| Função | Hoje | Novo | Razão |
|---|---|---|---|
| **Copilot — chat padrão** | DeepSeek-pro (default) | **DeepSeek-pro** (mantém) | melhor custo/raciocínio com tools |
| **Copilot — modo rápido** | DeepSeek-flash | **Gemini 3 Flash** | lookups simples 30× mais baratos |
| **Copilot — modo profundo** | Claude Sonnet 4.5 (default acessível) | **Claude removido do seletor** + flag `COPILOT_ALLOW_CLAUDE=false` server-side; só liga com env explícita | evita os US$ 0,50/turno acidentais |
| **lia-assign briefings** (1000+/dia) | DeepSeek | **Gemini 2.5 Flash-Lite** | prompt curto, alto volume — economia ~85% (de US$ 0,20/dia → US$ 0,03) |
| **Dra. LIA chat** | Gemini 2.5 Flash | mantém | já está otimizado |
| **cognitive-lead-analysis / workflow-diagnosis** | DeepSeek | mantém | baixo volume, precisa raciocínio |
| **Conteúdo/SEO/PDF/OG** | Gemini 2.5 Flash | mantém | já otimizado |
| **Watchdog anomaly** | DeepSeek (US$ 0,0002/dia) | mantém | irrelevante |

## Alterações técnicas

1. **`supabase/functions/smart-ops-copilot/index.ts`**
   - Remover bloco `claude` de `getModelConfig` por padrão; condicionar com `Deno.env.get("COPILOT_ALLOW_CLAUDE") === "true"`.
   - Trocar `deepseek-flash` (que hoje só baixa temperatura mas usa DeepSeek) por **Gemini 3 Flash** via gateway Lovable — renomear label para `gemini-flash`.
   - Default permanece `deepseek-pro`.
   - Atualizar selector no frontend `SmartOpsCopilot.tsx` para remover Claude da lista (ou esconder atrás de feature flag admin).

2. **`supabase/functions/_shared/waleads-messaging.ts`** (linha 394–418)
   - Trocar chamada `api.deepseek.com` por gateway Lovable `google/gemini-2.5-flash-lite`.
   - Manter mesma estrutura de prompt e `logAIUsage` (provider passa a `lovable`).

3. **Memory**: adicionar `mem://strategy/ai-model-routing-v1` documentando a matriz acima como regra fixa.

## Impacto esperado

- Custo médio diário: **~US$ 0,30 → ~US$ 0,05** (–83%)
- Pico de Claude impossível por acidente
- Latência de briefings cai (~30%) — Gemini Flash-Lite responde em 600ms vs DeepSeek 1,5s

## O que NÃO muda

- Personas, prompts, tools, lógica de negócio do Copilot/Dra. LIA
- Modelos de geração de imagem e conteúdo
- Embeddings
- Provider Anthropic permanece configurado (só não é selecionável)

Pronto para implementar — me dá go.