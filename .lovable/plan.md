

# Plano: Corrigir conteúdos corrompidos na Base de Conhecimento

## Diagnóstico

Encontrei **dois problemas graves** nos dados da tabela `knowledge_contents`:

### 1. HTML corrompido com links aninhados — **657 de 770 artigos afetados** (85%)

O pipeline de geração de conteúdo (provavelmente `auto-inject-product-cards` ou `ai-orchestrate-content`) inseriu `<a href="...">` dentro de atributos `href`, criando HTML inválido que quebra o layout. Exemplo:

```html
<!-- CORROMPIDO -->
href="https://loja.smartdent.com.br/pos-cura-<a href="https://loja.smartdent.com.br/shapecure">ShapeCure</a>"

<!-- DEVERIA SER -->
href="https://loja.smartdent.com.br/shapecure"
```

### 2. Artigos de produtos misturados na categoria E (Depoimentos e Cursos) — **~166 artigos irrelevantes**

Artigos sobre resinas, cimentos e tutoriais genéricos foram classificados na categoria E. Títulos como "UniKK VENNER: Cimento Dental", "Amarelamento Resinas 3D", "Atos: Resina Nanohíbrida" não são depoimentos.

## Alterações propostas

### 1. Nova Edge Function: `supabase/functions/fix-corrupted-links/index.ts`

Script de limpeza que:
- Percorre todos os 657 artigos com HTML corrompido
- Usa regex para detectar padrões `href="...<a ...>...</a>..."` aninhados
- Extrai a URL correta do `<a>` interno e reconstrói o link limpo
- Remove tags `<a>` soltas dentro de atributos
- Limpa o padrão `[SUA URL CANÔNICA AQUI - Ex: <a href=` (placeholder esquecido)
- Opera em modo dry-run (preview) ou write (aplicar)
- Registra relatório de quantos artigos corrigidos

### 2. Nova Edge Function: `supabase/functions/fix-category-e-cleanup/index.ts`

Script de auditoria que:
- Lista todos os artigos da categoria E que **não** contêm palavras-chave de depoimento/curso
- Move artigos para a categoria correta (C = Tutoriais, D = Produtos) com base em heurísticas de título
- Opera em modo dry-run primeiro para revisão manual

### 3. Correção no `auto-inject-product-cards` para prevenir recorrência

- Adicionar sanitização: antes de injetar um card, verificar se a `shop_url` do produto contém HTML (`<a`) e limpá-la
- Verificar se os slugs no `system_a_catalog` estão contaminados (encontrei slugs com URLs completas como `https://loja.smartdent.com.br/...` em vez de slugs simples)

## Detalhes técnicos

A raiz do problema parece ser dupla:
1. **Slugs contaminados** no `system_a_catalog` — o campo `slug` contém URLs completas em vez de slugs, e o `auto-inject-product-cards` usa esses slugs para construir links, causando concatenação quebrada
2. **AI gerando links com HTML** — o pipeline de conteúdo AI injeta `<a>` tags dentro de atributos de outras tags

## Arquivos afetados
- `supabase/functions/fix-corrupted-links/index.ts` — **novo**
- `supabase/functions/fix-category-e-cleanup/index.ts` — **novo**
- `supabase/functions/auto-inject-product-cards/index.ts` — correção preventiva
- `supabase/config.toml` — registrar novas functions

