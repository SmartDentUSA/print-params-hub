

## Corrigir URLs expostas nos artigos em Ingles e Espanhol

### Problema

Os artigos em EN e ES contem links `<a>` cujo texto visivel e a URL crua (ex: `https://drive.google.com/file/d/...`). A funcao `prettifyLinkLabels` ja processa esses links, mas os labels gerados por `getFriendlyLabel` estao todos em portugues ("Ver Documento", "Assistir Video", "Ver na Loja", etc.).

Alem disso, 3 artigos em EN e 3 em ES possuem URLs expostas no banco de dados.

### Solucao

**1. Internacionalizar `getFriendlyLabel`** — receber o idioma como parametro e retornar labels no idioma correto:

| Dominio | PT | EN | ES |
|---|---|---|---|
| drive/docs.google | Ver Documento | View Document | Ver Documento |
| loja.smartdent | (nome do produto) | (nome do produto) | (nombre del producto) |
| youtube | Assistir Video | Watch Video | Ver Video |
| pubmed | Ver Estudo (PubMed) | View Study (PubMed) | Ver Estudio (PubMed) |
| fallback | Ver Link | View Link | Ver Enlace |

**2. Atualizar `prettifyLinkLabels`** — passar o idioma ativo para `getFriendlyLabel`.

**3. Atualizar a chamada** na linha 383-384 — passar `language` para `prettifyLinkLabels`.

### Arquivo alterado

- `src/components/KnowledgeContentViewer.tsx` — modificar `getFriendlyLabel` e `prettifyLinkLabels` para aceitar parametro de idioma

### Secao tecnica

```text
getFriendlyLabel(url, language)
  -> mapa de labels por idioma { pt: {...}, en: {...}, es: {...} }
  -> retorna label no idioma correto

prettifyLinkLabels(html, language)
  -> passa language para getFriendlyLabel dentro do replace

processedHTML = prettifyLinkLabels(..., language)
```

Alteracao pequena, concentrada em ~30 linhas no topo do arquivo.

