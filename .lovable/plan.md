

## Corrigir: Links schema.org convertidos em tags `<a>` pelo reformatador

### Problema

A correcao anterior (`cleanSchemaMarkup` no `DirectHTMLRenderer.tsx`) remove atributos microdata crus, mas **nao cobre o caso real**: o reformatador de artigos (`reformat-article-html`) converteu as URLs schema.org em links clicaveis:

```html
<a href="https://schema.org/HowToStep" target="_blank" rel="noopener noreferrer" class="text-primary underline">https://schema.org/HowToStep</a>
```

Isso significa que no HTML do banco de dados, as URLs schema.org estao dentro de tags `<a>`, e o regex atual nao as detecta.

### Solucao

Adicionar um regex extra na funcao `cleanSchemaMarkup` em `DirectHTMLRenderer.tsx` para remover tags `<a>` que apontam para `schema.org`:

```js
// Remove <a> tags linking to schema.org (created by reformatter)
cleaned = cleaned.replace(/<a\s[^>]*href="https?:\/\/schema\.org\/[^"]*"[^>]*>[^<]*<\/a>/gi, '');
```

### Arquivo alterado

`src/components/DirectHTMLRenderer.tsx` - adicionar 1 linha na funcao `cleanSchemaMarkup`

### Resultado

- Links schema.org clicaveis serao removidos da renderizacao
- O texto "https://schema.org/HowToStep" deixa de aparecer nos artigos
- Combinado com os regex existentes, cobre tanto microdata crua quanto links convertidos

