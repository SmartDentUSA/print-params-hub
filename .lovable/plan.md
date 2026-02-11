

## Corrigir: Reformatador de HTML salvando texto puro em vez de HTML

### Problema

A IA (Gemini) retorna o HTML reformatado envolvido em blocos de codigo Markdown, como:

~~~
```html
<h2>Titulo</h2>
<p>Conteudo...</p>
```
~~~

Quando esse conteudo e salvo no banco de dados, os marcadores ` ```html ` e ` ``` ` sao incluidos, fazendo com que o artigo inteiro seja exibido como texto puro no site.

### Correcao

**Arquivo:** `supabase/functions/reformat-article-html/index.ts`

Adicionar uma funcao de limpeza logo apos receber a resposta da IA (antes do pos-processamento de URLs) que:

1. Remove ` ```html ` ou ` ``` ` do inicio da resposta
2. Remove ` ``` ` do final da resposta  
3. Faz `.trim()` para eliminar espacos extras

```js
function stripMarkdownCodeFences(text: string): string {
  let cleaned = text.trim();
  // Remove abertura: ```html ou ```
  cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '');
  // Remove fechamento: ```
  cleaned = cleaned.replace(/\n?```\s*$/, '');
  return cleaned.trim();
}
```

Aplicar antes do `convertPlainUrlsToLinks`:

```js
const cleanedHtml = stripMarkdownCodeFences(rawReformattedHtml);
const reformattedHtml = convertPlainUrlsToLinks(cleanedHtml);
```

### Detalhe tecnico

- Alteracao em 1 arquivo apenas: `supabase/functions/reformat-article-html/index.ts`
- Linhas afetadas: ~105-115 (apos receber `rawReformattedHtml`)
- Artigos ja corrompidos precisarao ser reformatados novamente apos o fix

