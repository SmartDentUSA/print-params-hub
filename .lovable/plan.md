## Problema identificado

A tela `/social/novo` não está travando por erro visual do React. O erro vem da Edge Function `social-caption-generator` quando o usuário clica em gerar legenda.

Logs recentes confirmam:

```text
[social-caption-generator] 502 You've used up your points! Visit https://poe.com/api/keys to get more.
[caption] ai-router falhou:
- lovable/google/gemini-3-flash-preview: 402 Not enough credits
- poe/gemini-3-flash: 402 You've used up your points
```

Ou seja: os dois provedores de IA configurados ficaram sem créditos. A função transforma isso em HTTP `502`, então o frontend recebe apenas o erro genérico do Supabase:

```text
Edge Function returned a non-2xx status code
```

## Correção proposta

### 1. Backend: `supabase/functions/social-caption-generator/index.ts`

Alterar o tratamento de erro da função para **não retornar 502 genérico** quando o problema é crédito/limite de IA.

Novo comportamento:

- Se o `ai-router` falhar com `402`, `payment_required`, `Not enough credits`, `used up your points`:
  - retornar HTTP `200`
  - JSON estruturado:
    ```json
    {
      "error": "AI_CREDITS_EXHAUSTED",
      "message": "Créditos de IA indisponíveis no momento...",
      "fallback": true,
      "caption": "",
      "hashtags": [],
      "first_comment": ""
    }
    ```
- Se for erro recuperável de provedor (`429`, `5xx`):
  - retornar HTTP `200` com `fallback: true` e mensagem clara
- Se for erro de validação do usuário (`400`):
  - manter HTTP `400`
- Manter CORS em todas as respostas.

Isso evita toast genérico e impede que a UI pareça quebrada.

### 2. Frontend: `src/hooks/social/useGenerateCaption.ts`

Atualizar o hook para reconhecer respostas de fallback:

- Se `data.fallback === true`, lançar erro com `data.message`/`data.error`, não com a mensagem genérica do Supabase.
- Se vier `error.context.responseJson`, priorizar a mensagem real do backend.
- Preservar o texto que o usuário já digitou.

### 3. Frontend: `src/components/social/editor/steps/StepContent.tsx`

Melhorar a experiência no botão “Gerar legenda”:

- Quando falhar por crédito de IA, mostrar toast claro:
  ```text
  IA sem créditos no momento. Use uma copy pronta do Sistema A ou escreva manualmente.
  ```
- Não limpar legenda, hashtags nem primeiro comentário existentes.
- Se houver copies prontas do Sistema A, orientar o usuário a usar essas copies.

## Resultado esperado

- `/social/novo` deixa de “travar” ou aparentar quebra.
- O erro passa a explicar a causa real: falta de créditos nos provedores de IA.
- O usuário continua podendo:
  - selecionar produto
  - selecionar carrossel
  - usar copy pronta do Sistema A
  - escrever manualmente
  - avançar para mídia/upload
- Quando os créditos forem recarregados, a geração de IA volta a funcionar sem nova mudança de código.

## Fora do escopo

- Recarregar créditos Lovable/Poe.
- Trocar arquitetura do `ai-router`.
- Alterar banco de dados ou migrations.
- Alterar outras telas do Social Publisher.
