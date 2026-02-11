

## Corrigir bug de detecao de links no AdminArticleReformatter

### Problema

Na linha 49 do arquivo `src/components/AdminArticleReformatter.tsx`, a deteccao de links usa:

```js
const hasLinks = html.includes('<a href');
```

Isso falha quando o HTML tem atributos antes do `href`, como `<a target="_blank" rel="noopener" href="...">`, resultando em falsos negativos.

### Correcao

Substituir a linha 49 por uma regex que detecta `<a` seguido de qualquer atributo antes do `href`:

```js
const hasLinks = /<a\s[^>]*href=/i.test(html);
```

### Arquivo alterado

- `src/components/AdminArticleReformatter.tsx` - linha 49: trocar `html.includes('<a href')` por `/<a\s[^>]*href=/i.test(html)`

Alteracao de uma unica linha, sem efeitos colaterais.

