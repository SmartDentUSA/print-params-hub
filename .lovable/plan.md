## Adicionar Google Tag Manager ao index.html

### Objetivo
Inserir os snippets do Google Tag Manager (GTM) no arquivo `index.html` existente, mantendo todo o conteúdo atual.

### Alterações Necessárias

#### 1. No `<head>` (antes do `</head>`)
**Localização:** Após a linha 156 (após o link do Atom feed) e antes do `</head>` na linha 157.

**Snippet a adicionar:**
```html
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-NZ64Q899');</script>
    <!-- End Google Tag Manager -->
```

#### 2. No `<body>` (após a tag `<body>`)
**Localização:** Após a linha 159 (`<body>`) e antes do skip link na linha 160.

**Snippet a adicionar:**
```html
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NZ64Q899"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
```

### Notas Importantes
- O GTM ID `GTM-NZ64Q899` já está presente no arquivo (linhas 188-192 e 166-168), mas está posicionado no final do `<body>` (deferred loading)
- Esta alteração move o script principal para o `<head>` (padrão recomendado do GTM) e adiciona o `<noscript>` fallback no início do `<body>`
- Todo o conteúdo existente deve ser preservado

### Arquivo Alvo
- `index.html` (raiz do projeto)