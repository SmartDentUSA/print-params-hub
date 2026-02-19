
# Novo comportamento: Dra. L.I.A. sugere link da impressora quando sem resina específica

## Objetivo

Quando o usuário perguntar sobre parâmetros de impressão **sem citar uma resina específica** (ex: "quais os parâmetros para a Anycubic Photon Mono 4?", "parâmetros para minha impressora X"), a Dra. L.I.A. deve responder com um link direto para a página da impressora no site: `/{brand_slug}/{model_slug}` — em vez de tentar buscar parâmetros sem contexto de resina.

## Causa raiz do comportamento atual

A edge function `dra-lia` não detecta esse padrão. Quando o usuário cita apenas uma impressora + parâmetros, o sistema faz uma busca no knowledge base e retorna resultados genéricos. Não existe lógica de detecção de "pergunta de parâmetros sem resina" nem lógica de busca em `brands`/`models` para montar o link correto.

## Solução — 2 mudanças no `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Detecção do intent "parâmetros + impressora + sem resina"

Adicionar função `isPrinterParamQuestion(msg)` que detecta quando:
- A mensagem menciona palavras de parâmetros (`parâmetro`, `configuração`, `setting`, `exposição`, `layer`, `como imprimir`, `how to print`, etc.)
- **E NÃO** cita nenhuma resina conhecida pelo nome

```typescript
// Palavras que indicam pedido de parâmetros
const PARAM_KEYWORDS = [
  /parâmetro|parametro|parameter/i,
  /configuração|configuracao|setting/i,
  /\bexposição\b|exposicao|exposure/i,
  /layer height|espessura/i,
  /como imprimir|how to print|cómo imprimir/i,
];

const isPrinterParamQuestion = (msg: string) =>
  PARAM_KEYWORDS.some((p) => p.test(msg));
```

### Mudança 2 — Busca de impressora por nome + geração de link

Adicionar função `findPrinterInMessage(supabase, message)` que:
1. Consulta todos os `models` ativos com seus `brands` 
2. Faz fuzzy match por nome (split em words, verifica se alguma word do nome do modelo/marca aparece na mensagem)
3. Retorna `{ brand_slug, model_slug, brand_name, model_name }` se encontrar

```typescript
async function findPrinterInMessage(supabase, message) {
  const { data: models } = await supabase
    .from('models')
    .select('slug, name, brands(slug, name)')
    .eq('active', true);
  
  const msg = message.toLowerCase();
  
  for (const model of models) {
    const modelWords = model.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matchCount = modelWords.filter(w => msg.includes(w)).length;
    
    if (matchCount >= 2 || (matchCount === 1 && model.name.toLowerCase().split(/\s+/).length <= 2)) {
      return {
        brand_slug: model.brands.slug,
        model_slug: model.slug,
        brand_name: model.brands.name,
        model_name: model.name,
      };
    }
  }
  return null;
}
```

### Mudança 3 — Intercept antes do RAG (após greeting guard)

No fluxo principal, após o intent guard de saudação, adicionar:

```typescript
// 0b. Intent Guard — parâmetros sem resina → link da impressora
if (isPrinterParamQuestion(message)) {
  const printer = await findPrinterInMessage(supabase, message);
  
  if (printer) {
    const printerUrl = `/${printer.brand_slug}/${printer.model_slug}`;
    const linkText = getLinkText(lang, printer.brand_name, printer.model_name, printerUrl);
    // Stream a resposta diretamente sem chamar a IA
    return streamTextResponse(linkText, ...);
  }
  // Se não encontrou impressora, segue fluxo normal (RAG)
}
```

### Mensagem de resposta localizada (3 idiomas)

```
PT: "Para ver todos os parâmetros disponíveis para a **{brand} {model}**, acesse a página da impressora:
👉 [Ver parâmetros da {brand} {model}](/{brand_slug}/{model_slug})

Lá você encontra os parâmetros organizados por resina. Se precisar de uma resina específica, me diga o nome dela!"

EN: "To see all available parameters for the **{brand} {model}**, visit the printer page:
👉 [View {brand} {model} parameters](/{brand_slug}/{model_slug})

Parameters are organized by resin there. Tell me the resin name if you need specific values!"

ES: "Para ver todos los parámetros disponibles para la **{brand} {model}**, visita la página de la impresora:
👉 [Ver parámetros de {brand} {model}](/{brand_slug}/{model_slug})

Los parámetros están organizados por resina. ¡Dime el nombre de la resina si necesitas valores específicos!"
```

## Fluxo completo após a mudança

```text
Usuário: "quais os parâmetros para a Anycubic Photon Mono 4?"
                    ↓
isPrinterParamQuestion() → true (contém "parâmetros")
                    ↓
findPrinterInMessage() → { brand_slug: "anycubic", model_slug: "photon-mono-4", ... }
                    ↓
Resposta direta (sem RAG, sem IA):
"Para ver todos os parâmetros disponíveis para a **Anycubic Photon Mono 4**,
acesse a página da impressora:
👉 [Ver parâmetros da Anycubic Photon Mono 4](/anycubic/photon-mono-4)

Lá você encontra os parâmetros organizados por resina. Se precisar de uma
resina específica, me diga o nome dela!"
```

## O que NÃO muda

- Se o usuário citar impressora **E** resina (ex: "parâmetros Anycubic + Smart Print Bio"), o fluxo atual de RAG segue normalmente — a busca de parâmetros específicos funciona como antes
- Se o usuário pedir parâmetros de uma impressora **não encontrada** no banco, o fluxo normal de RAG também continua
- Se não for uma pergunta de parâmetros (sem as keywords), nenhum intercept acontece

## Seção Técnica

- Único arquivo alterado: `supabase/functions/dra-lia/index.ts`
- A query em `models` retorna todos os modelos ativos com seus brands — é uma consulta leve (poucos registros, sem paginação necessária)
- O intercept acontece **antes** de chamar `searchKnowledge` — evita custo de RAG + chamada de IA para esse caso específico
- A resposta é streamed (igual ao greeting guard) via `ReadableStream` com tokens word-by-word — UX idêntica ao restante do chat
- `interactionId` é gravado com `unanswered: false` para o feedback funcionar normalmente
- Nenhuma migração de banco necessária
- Deploy automático após salvar
