

## Botao "Baixar HTML" no Artigo

Sim, e totalmente possivel! O botao vai gerar um arquivo `.html` completo e autonomo, com CSS embutido, pronto para colar em qualquer blog/servidor externo.

### O que sera feito

Adicionar um botao **"Baixar HTML"** na area de conteudo do artigo (ao lado do botao de download existente, linha ~522-534). Ao clicar, o navegador faz download de um arquivo `.html` contendo:

- O titulo do artigo como `<h1>` e `<title>`
- O HTML completo do artigo (ja processado e limpo de schema.org)
- CSS basico embutido (tipografia, imagens responsivas, tabelas, listas) para que o arquivo funcione sozinho em qualquer dominio
- Meta charset UTF-8 para acentos
- Imagens mantem as URLs absolutas originais (funcionam em qualquer lugar)

### Como funciona

1. O botao chama uma funcao `handleDownloadHTML` que:
   - Monta um documento HTML completo com `<head>` (meta, title, style) e `<body>` (conteudo do artigo)
   - Cria um `Blob` com tipo `text/html`
   - Dispara o download com nome `{slug}.html`

2. O CSS embutido inclui estilos basicos para que o artigo fique legivel sem depender de nenhum framework externo

### Onde aparece o botao

Na secao de conteudo do `KnowledgeContentViewer.tsx`, logo acima do conteudo HTML (proximo ao botao "Download" existente na linha 522), com icone de download e texto "Baixar HTML".

### Arquivo alterado

- `src/components/KnowledgeContentViewer.tsx` - adicionar funcao `handleDownloadHTML` e botao na UI

### Secao tecnica

```text
Fluxo:
  Clique no botao
    -> Monta string HTML completa (doctype + head + body + css inline)
    -> new Blob([htmlString], { type: 'text/html' })
    -> URL.createObjectURL(blob)
    -> <a download="{slug}.html"> click programatico
    -> URL.revokeObjectURL()
```

O HTML gerado usa o mesmo `processedHTML` ja calculado no componente (com schema.org limpo e links prettificados), garantindo que o conteudo exportado e identico ao exibido.

