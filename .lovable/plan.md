

## Corrigir: URLs schema.org aparecendo como texto visivel no conteudo

### Problema

O conteudo HTML de alguns artigos (gerado pela IA) contem marcacao **microdata schema.org** embutida diretamente nas tags HTML, como:

```html
<div itemscope itemtype="https://schema.org/HowTo">
<div itemscope itemtype="https://schema.org/HowToStep">
```

Quando renderizado pelo `DirectHTMLRenderer` via `dangerouslySetInnerHTML`, essas URLs aparecem como texto visivel na pagina. O resultado e que o usuario ve linhas como:

> https://schema.org/HowTo">Protocolo de Preparacao...
> https://schema.org/HowToStep">Passo 1: Inspecao...

### Causa Raiz

A IA que gera o conteudo (provavelmente `ai-orchestrate-content` ou `reformat-article-html`) esta inserindo microdata schema.org diretamente no HTML do artigo. Em alguns casos a marcacao esta malformada, fazendo com que as URLs vazem como texto.

Isso e **redundante** porque o sistema ja possui:
- `KnowledgeSEOHead.tsx` - injeta JSON-LD schemas no client-side
- `seo-proxy` - injeta JSON-LD schemas no SSR para Googlebot

### Solucao

Limpar os atributos de microdata schema.org do HTML antes de renderizar, no `DirectHTMLRenderer.tsx`. Isso remove a marcacao redundante sem afetar o SEO (que ja e coberto pelo JSON-LD).

### Detalhes Tecnicos

**Arquivo:** `src/components/DirectHTMLRenderer.tsx`

Adicionar uma etapa de limpeza na funcao `processHTML` que remove atributos de microdata:

1. Remover `itemscope` de qualquer tag
2. Remover `itemtype="https://schema.org/..."` de qualquer tag
3. Remover `itemprop="..."` de qualquer tag (exceto os ja usados pelo proprio componente)
4. Limpar texto solto que contenha URLs schema.org (caso de markup malformado)

```js
const cleanSchemaMarkup = (html: string): string => {
  // Remove itemscope attribute
  let cleaned = html.replace(/\s*itemscope\s*/gi, ' ');
  // Remove itemtype="https://schema.org/..."
  cleaned = cleaned.replace(/\s*itemtype="https?:\/\/schema\.org\/[^"]*"/gi, '');
  // Remove itemprop="..." from content HTML
  cleaned = cleaned.replace(/\s*itemprop="[^"]*"/gi, '');
  // Clean up broken markup where schema URLs leak as text
  cleaned = cleaned.replace(/https?:\/\/schema\.org\/\w+"\s*>/gi, '');
  return cleaned;
};
```

Aplicar antes do `processHTML` existente:

```js
const cleanedHTML = cleanSchemaMarkup(htmlContent);
const processedHTML = processHTML(cleanedHTML);
```

**Nota:** O `itemScope` e `itemType` no proprio componente `<article>` (linha 46-47) continuam funcionando normalmente pois sao atributos React, nao parte do conteudo HTML injetado.

### Resultado

- URLs schema.org nao aparecerao mais como texto visivel
- SEO nao e afetado (JSON-LD continua funcionando via KnowledgeSEOHead e seo-proxy)
- Artigos existentes com microdata serao limpos automaticamente na renderizacao
- Alteracao em 1 arquivo apenas: `DirectHTMLRenderer.tsx`

