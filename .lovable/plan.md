## Objetivo

Fazer o importador (`PublicAPIProductImporter` → edge `get-product-data`) voltar a buscar direto no **Sistema A live** quando o produto não estiver no espelho local, como funcionava antes. Assim `399446992` (id da Loja Integrada/Sistema A) e qualquer slug ainda não sincronizado passam a retornar dados.

## Escopo

Editar apenas a edge function `supabase/functions/get-product-data/index.ts`. Sem mudanças no frontend, sem migração de banco.

## Fluxo novo do endpoint

Ordem de resolução (a primeira que retornar dados vence):

1. Local `system_a_catalog` por `slug` exato (já existe).
2. Local `system_a_catalog` por `external_id` quando o parâmetro for numérico (já existe).
3. Local `system_a_catalog` por `slug ilike '%…%'` (já existe).
4. Local `resins` por `slug` (já existe).
5. **[NOVO] Sistema A live** — fallback final, chamando:
   - `https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id=<slug>` quando o valor for numérico;
   - `…?slug=<slug>` caso contrário.
   Timeout curto (8s), soft-fail: se o live também não achar/erros de rede, mantém o 404 atual.
6. Se nada retornar, 404 como hoje.

A resposta do Sistema A live é remapeada para o mesmo shape que o endpoint já devolve (`id`, `external_id`, `name`, `slug`, `description`, `image_url`, `price`, `promo_price`, `currency`, `url`, `canonical_url`, `seo_title_override`, `seo_description_override`, `keywords`, `product_category`, `product_subcategory`), com `message: 'Produto encontrado (Sistema A live)'` para diagnóstico.

## Detalhes técnicos

- Reaproveitar o padrão do `_shared/system-a-live.ts` (já existe no projeto): fetch com `AbortController` de 8s, tratamento de erro silencioso, sem cache persistente aqui (o refresh continua sendo responsabilidade do `smart-ops-refresh-system-a-cache`).
- Logs `console.log('🌐 Fallback Sistema A live', { param, status })` para facilitar debug.
- Não persistir o produto encontrado — apenas responder ao caller. O importador, ao clicar "Importar", segue gravando localmente como já faz.
- CORS e formato de resposta inalterados.

## Validação

- `curl …/get-product-data?slug=399446992&approved=true` → 200 com dados do SmartSlicer vindos do Sistema A live.
- `curl …/get-product-data?slug=software-smart-slicer` → 200 continua vindo do local.
- `curl …/get-product-data?slug=slug-inexistente-xyz` → 404 como hoje.
- Testar no admin: colar `399446992` no importador e conferir preview populado.

## Fora de escopo

- Não vou criar coluna nova, mapear LI id ↔ catálogo, nem alterar RLS/GRANTs.
- Não vou tocar em outros lugares que chamam o endpoint (`ProductPage`, `KbTabCatalogo` seguem funcionando pelo fluxo local).