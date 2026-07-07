## Objetivo

Na página pública do produto (`/produto/:slug`), exibir dois botões quando o produto tiver um formulário SmartOps atrelado (via `smartops_forms.product_catalog_id`) e existirem short links publicados:

- **Saiba mais** → short link da landing page (`default_target = 'landing_page'`)
- **Entre em contato** → short link do formulário (`default_target = 'form'`)

Regra: cada botão só aparece se o short link correspondente existir.

## Onde alterar

`src/pages/ProductPage.tsx` — apenas frontend, sem mudanças de schema, RLS, ou edge functions.

## Como implementar

1. Após buscar o `product`, disparar consulta adicional:
   ```ts
   supabase.from('smartops_forms')
     .select('id, slug')
     .eq('product_catalog_id', product.id)
     .maybeSingle();
   ```
2. Se existir form, buscar short links:
   ```ts
   supabase.from('smartops_short_links')
     .select('short_code, default_target')
     .eq('form_slug', form.slug);
   ```
3. Guardar em estado:
   - `landingShortUrl`: `https://s.smartdent.com.br/{short_code}` do registro com `default_target='landing_page'`
   - `formShortUrl`: idem para `default_target='form'`
4. Renderizar os botões no bloco de CTAs existente (`ProductPage.tsx` ~linhas 276-292), logo após os CTAs `cta_1_url`/`cta_2_url`:
   - `Saiba mais` — `variant="default"`, ícone `ExternalLink`, abre `landingShortUrl` em nova aba, só se `landingShortUrl` existir.
   - `Entre em contato` — `variant="secondary"`, ícone `MessageCircle`, abre `formShortUrl` em nova aba, só se `formShortUrl` existir.
   - Ambos com `rel="noopener noreferrer"` e `target="_blank"`.
5. Sem loading states extras: enquanto os short links não carregam, os botões simplesmente não aparecem.

## Fora do escopo

- Não altera admin, listagem, `InlineProductCard`, `CategoryPage`, ou outros cards.
- Não cria/edita short links (usa apenas os que já existem em `smartops_short_links`).
- Não muda os CTAs manuais (`cta_1_url`, `cta_2_url`) do produto — os novos botões aparecem em adição a eles.
- Sem novos textos i18n neste momento (labels hardcoded em PT: "Saiba mais" / "Entre em contato").
