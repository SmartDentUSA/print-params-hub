

# Plano: Remover Product Cards do corpo visível dos Depoimentos (Cat. E)

## Diagnóstico

O pipeline de IA (`auto-inject-product-cards` / `ai-orchestrate-content`) injetou `inline-product-card` divs **diretamente no corpo visível** dos artigos de Depoimentos e Cursos (categoria E). São cards com "📦 Produto Recomendado" intercalados entre parágrafos — aparecem como imagens grandes no meio do conteúdo.

- **36 artigos** afetados na categoria E
- Cada artigo tem **4-5 cards** visíveis no body
- Os cards também existem na camada oculta `llm-knowledge-layer` (duplicados)

## Solução

Atualizar a Edge Function `fix-corrupted-links` para adicionar um novo pattern de limpeza que remove `<div class="inline-product-card">...</div>` do corpo visível dos artigos da categoria E.

### Etapa 1: Adicionar lógica de remoção de product cards

Na função `cleanCorruptedHtml`, adicionar um regex que remove blocos completos de `inline-product-card`:

```regex
<div class="inline-product-card"[^>]*>[\s\S]*?<\/div>\s*<\/a>\s*<\/div>\s*<\/div>
```

Ou usar um parser DOM simples para remover todas as divs com classe `inline-product-card` que estejam **fora** da seção `llm-knowledge-layer`.

### Etapa 2: Executar em dry-run para validar

Invocar a function com `dryRun: true` filtrando apenas categoria E.

### Etapa 3: Executar com `dryRun: false`

Aplicar as remoções nos 36 artigos (nas 3 colunas: `content_html`, `content_html_en`, `content_html_es`).

## Arquivos afetados

- `supabase/functions/fix-corrupted-links/index.ts` — adicionar pattern de remoção de product cards para categoria E

## Alternativa considerada

Remover via SQL direto com `regexp_replace`, mas o HTML multi-linha torna regex em SQL frágil. A Edge Function com JavaScript é mais segura.

