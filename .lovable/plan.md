
# Dra. L.I.A. — Passo de Resina: Perguntar Primeiro, Verificar Depois

## O problema exato

No passo `needs_resin` (quando o modelo foi encontrado), a mensagem atual é:

```
"Encontrei a Anycubic Mono X! Qual resina você vai usar?

Resinas com parâmetros cadastrados para essa impressora:
Smart Print Bio Clear Guide, Smart Print Bio Denture (Rosa), Smart Print Bio Hybrid A2...

Ou acesse diretamente todos os parâmetros:
👉 [Ver todos os parâmetros da Anycubic Mono X](/anycubic/mono-x)"
```

O problema: jogar uma lista enorme de resinas antes de o usuário nem responder é ruim para UX — o usuário pode ter uma resina diferente das listadas, ou já saber o nome da sua resina sem precisar ler a lista. A L.I.A. deve **perguntar primeiro** e **verificar depois**.

## Comportamento novo — 2 mudanças no `supabase/functions/dra-lia/index.ts`

### Mudança 1 — `ASK_RESIN`: remover a lista de resinas da pergunta

A mensagem do passo 3 (`needs_resin`) passa de:

```
"Encontrei a Anycubic Mono X! Qual resina você vai usar?
Resinas com parâmetros cadastrados: Smart Print Bio Vitality, Smart Print Bio Clear Guide..."
```

Para:

```
"Encontrei a **Anycubic Mono X**! Qual **resina** você vai usar?
Me diga o nome da resina e verifico os parâmetros para você 😊"
```

**A função `fetchAvailableResins` ainda é chamada**, mas agora ela é usada apenas internamente no passo 4 (`has_resin`) para fazer o match — não é mais exibida na pergunta.

### Mudança 2 — `RESIN_NOT_FOUND`: mostrar as resinas disponíveis SOMENTE quando a resina não é encontrada

No passo 4, quando a resina não existe no banco, a resposta atual já lista as resinas como fallback — esse comportamento se mantém. Isso é o momento certo para mostrar a lista: quando o usuário pediu algo que não existe.

```
"Ainda não temos parâmetros da **Vitamine** para a Anycubic Mono X.

Resinas com parâmetros cadastrados para esse modelo:
Smart Print Bio Vitality, Smart Print Bio Clear Guide...

Ou acesse todos os parâmetros:
👉 [Ver parâmetros da Anycubic Mono X](/anycubic/mono-x)"
```

## Fluxo completo após a mudança

```text
Usuário: "preciso de parâmetros para minha impressora"
    ↓
L.I.A.: "Qual é a marca da sua impressora?
         Marcas disponíveis: Anycubic, Creality, Elegoo..."
    ↓
Usuário: "Anycubic"
    ↓
L.I.A.: "Ótimo! Qual é o modelo da impressora?
         Modelos disponíveis: Mono X, Photon D2 Dlp, Photon M2..."
    ↓
Usuário: "Mono X"
    ↓
L.I.A.: "Encontrei a Anycubic Mono X! Qual resina você vai usar?
         Me diga o nome da resina e verifico os parâmetros para você 😊"
    ↓
Usuário: "Smart Print Bio Vitality"
    ↓
[verifica no banco → encontrou]
L.I.A.: "Perfeito! Encontrei os parâmetros da Smart Print Bio Vitality
         para a Anycubic Mono X:
         👉 [Ver parâmetros](/anycubic/mono-x)"

--- Cenário: resina não encontrada ---
Usuário: "Vitamine"
    ↓
[verifica no banco → não encontrou]
L.I.A.: "Ainda não temos parâmetros da Vitamine para a Anycubic Mono X.
         Resinas disponíveis para esse modelo:
         Smart Print Bio Clear Guide, Smart Print Bio Denture...
         👉 [Ver todos os parâmetros](/anycubic/mono-x)"
```

## O que muda no código (apenas `index.ts`)

**Linha ~190-197 — `ASK_RESIN`**: remover o `resins.join(", ")` da pergunta e simplificar a mensagem.

```typescript
// ANTES
const ASK_RESIN = {
  "pt-BR": (brand, model, modelSlug, brandSlug, resins) =>
    `Encontrei a **${brand} ${model}**! Qual **resina** você vai usar?\n\nResinas com parâmetros cadastrados:\n${resins.join(", ")}\n\nOu acesse diretamente:\n👉 [Ver todos os parâmetros](/${brandSlug}/${modelSlug})`,
  // ...
};

// DEPOIS
const ASK_RESIN = {
  "pt-BR": (brand, model, modelSlug, brandSlug) =>
    `Encontrei a **${brand} ${model}**! Qual **resina** você vai usar?\n\nMe diga o nome da resina e verifico os parâmetros para você 😊`,
  "en-US": (brand, model, modelSlug, brandSlug) =>
    `Found **${brand} ${model}**! Which **resin** will you use?\n\nTell me the resin name and I'll check the parameters for you 😊`,
  "es-ES": (brand, model, modelSlug, brandSlug) =>
    `¡Encontré la **${brand} ${model}**! ¿Qué **resina** vas a usar?\n\nDime el nombre de la resina y verifico los parámetros para ti 😊`,
};
```

**Linha ~208-215 — `RESIN_NOT_FOUND`**: mostrar a lista de resinas disponíveis quando a resina pedida não existir.

```typescript
// DEPOIS — com lista de resinas disponíveis no fallback
const RESIN_NOT_FOUND = {
  "pt-BR": (resin, brand, model, brandSlug, modelSlug, availableResins) =>
    `Ainda não temos parâmetros da **${resin}** para a **${brand} ${model}**.\n\n` +
    (availableResins.length > 0
      ? `Resinas com parâmetros cadastrados para esse modelo:\n${availableResins.join(", ")}\n\n`
      : "") +
    `👉 [Ver todos os parâmetros da ${brand} ${model}](/${brandSlug}/${modelSlug})`,
  // en-US e es-ES seguem o mesmo padrão
};
```

**Linha ~318-332 — `detectPrinterDialogState`, step 4 (`liaAskedResin`)**: passar `availableResins` para `RESIN_NOT_FOUND` no caso de fallback.

**Linha ~190 — chamada de `ASK_RESIN`**: remover o parâmetro `resins` da assinatura da função (ou mantê-lo e ignorá-lo — para não quebrar a chamada existente).

**`fetchAvailableResins` no passo `needs_resin`**: ainda é chamado, mas o resultado só vai para o estado interno do `DialogState` — não é mais exibido na pergunta. No step 4, quando `liaAskedResin`, o `availableResins` é buscado do banco e passado para `RESIN_NOT_FOUND` quando necessário.

## O que não muda

- Marcas disponíveis: continuam sendo listadas na pergunta de marca (correto — é uma escolha fechada)
- Modelos disponíveis: continuam sendo listados na pergunta de modelo (correto — é uma escolha fechada)
- RAG e protocolos: inalterados
- Frontend: zero mudanças

## Seção Técnica

- Único arquivo alterado: `supabase/functions/dra-lia/index.ts`
- Mudanças afetam apenas as constantes `ASK_RESIN` e `RESIN_NOT_FOUND` (linhas ~190-215) e a passagem de `availableResins` no estado `has_resin` do step 4 (linhas ~318-332)
- A chamada `fetchAvailableResins` continua existindo no step 3 — pode ser removida (otimização) ou mantida para pré-validação futura
- O `DialogState` não muda — o campo `availableResins` pode ser removido de `needs_resin` se não for mais usado na mensagem, mas é seguro mantê-lo para uso interno
- Deploy automático ao salvar
