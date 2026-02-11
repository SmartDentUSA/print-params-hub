

## Corrigir URLs expostas como texto visivel nos artigos

### Problema

O HTML do artigo "Comparativo entre resinas" contem links onde o texto ancora e a propria URL completa. Exemplo real do banco:

```html
<a href="https://drive.google.com/file/d/1xaU0cfLlL5pxmxn0uij-EDEpg3X8SA5j/view">
  https://drive.google.com/file/d/1xaU0cfLlL5pxmxn0uij-EDEpg3X8SA5j/view
</a>
```

Isso resulta em URLs longas e ilegíveis aparecendo na pagina publica.

### Solucao

Adicionar uma funcao de pos-processamento no componente `KnowledgeContentViewer.tsx` que transforma URLs expostas em textos amigaveis antes de renderizar. A funcao detecta links cujo texto ancora e igual (ou quase igual) ao href e substitui por um label legivel baseado no dominio.

### Mapeamento de dominios para labels amigaveis

| Dominio | Label |
|---------|-------|
| drive.google.com | "Ver Documento" |
| loja.smartdent.com.br | Extrair nome do produto do path |
| docs.google.com | "Ver Documento" |
| youtube.com / youtu.be | "Assistir Video" |
| pubmed.ncbi.nlm.nih.gov | "Ver Estudo (PubMed)" |
| Outros | Mostrar apenas o dominio (ex: "exemplo.com") |

### Alteracoes

**Arquivo: `src/components/KnowledgeContentViewer.tsx`**

1. Criar funcao `prettifyLinkLabels(html: string): string` que usa regex para encontrar tags `<a>` cujo texto interno e uma URL (comeca com http) e substitui por um label amigavel mantendo todos os atributos do link intactos.

2. Aplicar a funcao ao `processedHTML` antes de passar para o `PDFContentRenderer` (~linha 457).

### Logica da funcao

```
function prettifyLinkLabels(html: string): string {
  // Regex: encontra <a ...>URL</a> onde o conteudo e uma URL
  return html.replace(
    /<a\s([^>]*href="([^"]*)"[^>]*)>(https?:\/\/[^<]+)<\/a>/gi,
    (match, attrs, href, visibleUrl) => {
      // So transforma se o texto visivel parece uma URL
      const label = getFriendlyLabel(href);
      return `<a ${attrs}>${label} ↗</a>`;
    }
  );
}

function getFriendlyLabel(url: string): string {
  if (url.includes('drive.google.com')) return 'Ver Documento';
  if (url.includes('docs.google.com')) return 'Ver Documento';
  if (url.includes('loja.smartdent.com.br')) {
    // Extrair nome do produto do slug
    const slug = url.split('/').pop();
    return slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Ver na Loja';
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Assistir Video';
  if (url.includes('pubmed')) return 'Ver Estudo (PubMed)';
  // Fallback: mostrar dominio limpo
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Ver Link';
  }
}
```

### Resultado esperado

Antes:
```
https://drive.google.com/file/d/1xaU0cfLlL5pxmxn0uij-EDEpg3X8SA5j/view
```

Depois:
```
Ver Documento ↗
```

Os links continuam clicaveis e abrindo em nova aba. Apenas o texto visivel muda para algo legivel.

