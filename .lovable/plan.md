

# Fix: Footer do formulario publico — layout e icones de redes sociais

## Problemas identificados

1. **Layout quebrado**: O container externo usa `flex items-start` sem `flex-col` nem `flex-wrap`. O footer fica ao lado do grid em vez de abaixo dele — visivel no screenshot onde o footer aparece no canto superior direito.

2. **Icones nao aparecem**: Mesmo com o codigo correto para renderizar icones, o layout faz o footer ficar comprimido e possivelmente os dados de `social_media` nao estao chegando (o `useCompanyData` pode retornar `social_media` como objeto vazio `{}`).

## Correção

**Arquivo:** `src/pages/PublicFormPage.tsx`

### Mudanca 1 — Corrigir layout flex
Adicionar `flex-col` e `flex-wrap` ao container principal (linha 332):

```
flex items-start justify-center → flex flex-col items-center
```

Isso faz o grid e o footer empilharem verticalmente, com o footer sempre abaixo do conteudo.

### Mudanca 2 — Garantir renderizacao dos icones
Remover a condicional `company?.social_media &&` que envolve o bloco de icones — se `social_media` for `{}` (objeto vazio, truthy), o `.filter(link => link.url)` ja cuida de esconder icones sem URL. O problema e que quando `company` ainda esta carregando, nada aparece. Usar fallback hardcoded para as redes sociais conhecidas da empresa.

## Resultado esperado

Footer centralizado abaixo do formulario, com icones de Instagram/YouTube/Facebook/LinkedIn clicaveis quando configurados no Sistema A.

