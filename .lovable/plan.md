

## Corrigir: URLs em texto plano nao viram hyperlinks na reformatacao

### Problema

O prompt do `reformat-article-html` diz "NAO adicione links que nao existam no HTML original", mas nao instrui a IA a converter URLs em texto plano (ex: `https://example.com`) em tags `<a href="...">`. A IA interpreta isso como "nao criar links novos" e ignora as URLs que ja estao no texto como texto puro.

### Solucao

Adicionar uma regra explicita no system prompt para converter URLs em texto plano em hyperlinks clicaveis, e tambem adicionar um pos-processamento programatico como fallback.

### Alteracoes

**Arquivo: `supabase/functions/reformat-article-html/index.ts`**

1. Adicionar instrucao no `systemPrompt` (na secao REGRAS DE FORMATACAO, ~linha 73):

```
- Se houver URLs em texto plano (ex: https://... ou http://...) que NAO estejam dentro de uma tag <a>, converta-as em hyperlinks: <a href="URL" target="_blank" rel="noopener noreferrer" class="text-primary underline">URL</a>
- Isso NAO e "adicionar links novos" — e transformar URLs existentes no texto em HTML semantico clicavel
```

2. Adicionar pos-processamento programatico no HTML retornado pela IA (~apos linha 120), antes de salvar no banco. Isso garante que mesmo que a IA falhe, URLs soltas serao convertidas:

```typescript
function convertPlainUrlsToLinks(html: string): string {
  // Regex que encontra URLs que NAO estao dentro de href="" ou src="" ou ja dentro de <a>
  return html.replace(
    /(?<!href="|src="|">)(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
  );
}
```

Essa funcao sera aplicada ao `reformattedHtml` antes do `previewOnly` check e do `update`.

### Resultado

- URLs em texto plano serao convertidas em links clicaveis tanto pela IA quanto pelo fallback programatico
- Links existentes (ja em tags `<a>`) nao serao duplicados gracas ao negative lookbehind na regex
- Nenhum link inventado sera adicionado (mantem o Principio-Mae)

