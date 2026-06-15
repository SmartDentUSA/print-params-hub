## Objetivo

Cadastrar as 2 resinas órfãs ("Smart Print Bio Direct Aligner" e "Smart Print Bio GOWhite") na tabela canônica `resins`, para que apareçam em Configurações > Configurações do Sistema > Resinas, e ficar com a mesma identidade dos cards já publicados em `system_a_catalog`.

## Contexto verificado

- `system_a_catalog` tem os 2 cards ativos/visíveis (`category=Resinas`, sem description/image/price).
- `resins` não tem nenhuma linha com nome/slug correspondente.
- Os documentos (resin_documents / catalog_documents) não serão tocados.

## Passos

1. **Inserir 2 linhas em `public.resins`** (via tool de insert), espelhando os dados básicos do catálogo:
   - **Direct Aligner**
     - `name`: "Smart Print Bio Direct Aligner"
     - `slug`: `smart-print-bio-direct-aligner`
     - `manufacturer`: "Smart Dent"
     - `type`: `standard` (default)
     - `active`: true
     - `system_a_product_id`: `5b227517-e7bf-47c5-bbe5-508944aff47e`
   - **GOWhite**
     - `name`: "Smart Print Bio GOWhite"
     - `slug`: `smart-print-bio-gowhite`
     - `manufacturer`: "Smart Dent"
     - `type`: `standard`
     - `active`: true
     - `system_a_product_id`: `2aa58081-d123-42b9-bbd4-2ea7be2f69b1`

2. **Linkar o catálogo de volta** (mesmo insert/update): garantir que `system_a_catalog.slug` aceite o match pelo regex já usado no mirror (`regexp_replace(slug,'-+$','')` + fallback por nome — o nome canônico "Smart Print Bio Direct Aligner" / "Smart Print Bio GOWhite" é sufixo dos nomes do catálogo "Resina 3D Smart Print Bio …", então a regra de match já existente vai casar).

3. **Não rodar mirror agora**: como as 2 novas linhas em `resins` estão "vazias" (sem description/SEO/CTAs), não há nada para espelhar. Quando você preencher os dados na UI de Configurações > Resinas, basta re-rodar o UPDATE de espelhamento idempotente já documentado em `mem/catalog/resins-canonical-mirror.md`.

## O que NÃO será alterado

- `resin_documents` e `catalog_documents` — preservados.
- Cards existentes em `system_a_catalog` (slug, name, category, visibilidade, prices) — preservados.
- Demais 28 resinas já cadastradas — não tocadas.

## Resultado esperado

- Configurações > Configurações do Sistema > Resinas passa a listar Direct Aligner e GOWhite (você completa documentos, SEO, CTAs por lá).
- Catálogo público continua exibindo os 2 cards como hoje.
- Próximo run do mirror trará automaticamente os campos preenchidos para `system_a_catalog`.
