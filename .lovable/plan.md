## Diagnóstico

Nos logs da edge function `generate-resin-info-card` aparece exatamente:

```
poe: Model `GPT-5.6-Sol` not found.
```

Como a chamada à LLM falha na 1ª linha do fluxo, o código lança `throw new Error(llm.error)` antes de renderizar/upload/atualizar `resins.info_card_url_*`. Resultado: nenhum PNG é gerado, nada é salvo no Storage, e a base de conhecimento continua sem imagem para exibir.

A causa é o **identifier do modelo Poe**. A API OpenAI-compatible do Poe usa handles em minúsculas (ex.: `gpt-5.4`, `gpt-5.5`, `claude-opus-4.8`). O bot correto é `gpt-5.6-sol` (o `GPT-5.6-Sol` com maiúsculas é o nome exibido no site, não o handle da API).

## Correção

1. **`supabase/functions/generate-resin-info-card/index.ts`**
   - Trocar `model: 'GPT-5.6-Sol'` → `model: 'gpt-5.6-sol'` na chamada `callPoe(...)`.
   - Atualizar as strings de log/retorno: `'poe/GPT-5.6-Sol'` → `'poe/gpt-5.6-sol'` (no `logAIUsage` e no `model_used` do response JSON).
   - Nenhuma outra alteração de lógica: paridade estrutural, retry, template determinístico e loop de idiomas seguem iguais.

2. **Fallback defensivo (mesmo arquivo)**
   - Se a chamada com `gpt-5.6-sol` retornar `status !== 200` com mensagem "not found" ou `status === 404`, tentar automaticamente `gpt-5.5` como fallback (modelo já validado em `ai_model_routing`) e continuar. Isso evita que uma renomeação futura do bot no Poe quebre novamente a UI.
   - Loga o modelo efetivamente usado em `logAIUsage` e no `model_used` do response.

## Validação após deploy

- Chamar a função pela UI ("Gerar Card Informativo") em uma resina com `processing_instructions` preenchidas.
- Conferir logs: deve aparecer boot + upload sem `Model not found`.
- Conferir na tabela `resins`: `info_card_url_pt/en/es` e `info_card_generated_at` preenchidos.
- Abrir a resina na Base de Conhecimento e confirmar que a imagem aparece ao final de "Pré e Pós Processamento" com o botão "Baixar card".

## Fora de escopo

- UI do `KbTabCatalogo` / `AdminModal` (já implementadas na iteração anterior).
- Estrutura de prompt / template HTML / paridade trilíngue (já funcionais — só falta a LLM responder).
- Tabela `ai_model_routing` (esta função não usa `aiComplete`; chama `callPoe` direto). Nenhuma migration necessária.
