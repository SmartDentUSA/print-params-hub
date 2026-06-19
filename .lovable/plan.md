## Remover campo de prompt manual nas capas de evento

A geração de capa por IA passa a usar **apenas** o prompt cinematográfico fixo (4 camadas) já definido em `event-generate-image`. O usuário não precisa mais escrever nada.

### Frontend — `src/components/smartops/events/EventAIPanels.tsx`
Em `EventCoverByLanguage`:
- Remover o bloco `Label + Textarea` "Prompt para IA (Poe — Nano-Banana)".
- Remover a validação `if (!prompt) return toast.error(...)` em `genAi`.
- Remover props `prompts` e `onPromptChange` da assinatura do componente.
- Não enviar `prompt` no `supabase.functions.invoke("event-generate-image", { body: ... })` (apenas `event_id`, `language`, `reference_image_url`, `logo_url`).
- Manter o botão "Gerar capa por IA ({lang})" como única ação.

### Callsite do componente
Localizar onde `EventCoverByLanguage` é usado (provavelmente no editor de evento em `src/components/smartops/events/...`) e remover as props `prompts` / `onPromptChange` e o estado correspondente. Não mexer em nada além disso.

### Backend — `supabase/functions/event-generate-image/index.ts`
- Tornar `prompt` opcional no `BodySchema` (`z.string().trim().max(2000).optional()`).
- Remover do `fullPrompt` final as linhas "Brief adicional do usuário:" + `prompt` quando não vier nada (manter caso ainda venha, por compatibilidade).
- Resto do prompt cinematográfico em 4 camadas permanece intacto e obrigatório.
- Redeploy da função.

### Fora de escopo
- Coluna `ai_image_prompt_{lang}` no banco fica como está (continua salvando o prompt fixo usado, útil para auditoria).
- Sem mudanças em `event-generate-about`, `event-web-research`, upload manual de capa, ou UI de "Imagem de referência / Logo do evento".
