## Objetivo

A tabela `resins` (Configurações do Sistema > Resinas) é a **fonte canônica** dos dados de resinas. O Catálogo de Produtos (`system_a_catalog`) tem cards das mesmas resinas que servem como espelho — e é onde se controla a visibilidade pública (`visible_in_ui`). Hoje os dois cadastros estão desalinhados: o catálogo tem cards com descrição/SEO/CTAs vazios ou desatualizados.

Vou popular cada card de resina no catálogo com os dados da resina correspondente em `resins`, **sem destruir o que já existe** no catálogo e **sem encostar em documentos**.

## Diagnóstico

- `resins`: 50 colunas, contém os dados ricos (description, technical_specs, clinical_indications, contraindications, compatibility_list, certifications, processing_instructions, ai_context, CTAs 1-4, SEO completo, image_url, wikidata_qid, anvisa_registration, fda_510k).
- `system_a_catalog`: 44 colunas. Para resinas existem ~30 cards, muitos duplicados (um com `category='resin'` inativo + um com `category='product'` ativo).
- Documentos vivem em tabelas separadas e **não serão tocados**:
  - `resin_documents` (resin_id) — Configurações
  - `catalog_documents` (product_id) — Catálogo
- 2 cards órfãos no catálogo sem par em `resins`: **Direct Aligner** e **GOWhite** (category='Resinas').

## Estratégia de match (resin → catalog card)

Para cada `resins.id`, achar o card de catálogo correspondente nesta ordem:
1. `system_a_catalog.slug = resins.slug` (com `product_category ILIKE '%resina%'`)
2. `lower(name) = lower(name)` quando slugs divergem (ex.: `resina-smart-print-temp` vs `resina-smart-print-temp-`)
3. Se houver duplicado (linha `category='resin'` inativa + linha `category='product'` ativa), **espelhar somente a linha ativa `category='product'`**. A linha legada `category='resin'` permanece intocada (não apagar — usuário pediu para não mudar nada).

Cards sem par em `resins` (Direct Aligner, GOWhite) ficam como estão — serão tratados em conversa separada, não fazem parte deste pedido.

## Campos espelhados (resins → system_a_catalog)

Sobrescrever no card de catálogo apenas onde a resina tem valor não-nulo/não-vazio (COALESCE pela origem `resins`), preservando o que já existe no catálogo quando a resina não tem dado:

- Conteúdo: `description`, `image_url`
- SEO: `seo_title_override`, `meta_description`, `og_image_url`, `canonical_url`, `keywords`, `keyword_ids`
- CTAs 1–3: `cta_{n}_label`, `cta_{n}_url`, `cta_{n}_description` (catálogo não tem CTA 4 — ignorado)
- Técnico/clínico: `technical_specs`, `clinical_indications`, `contraindications`, `compatibility_list`, `certifications`, `wikidata_qid`

**Campos NÃO espelhados** (preservar catálogo):
- `active`, `approved`, `visible_in_ui`, `display_order` — controlados pelo catálogo
- `slug`, `name` — não renomear cards
- `external_id`, `source`, `category`, `product_category`, `product_subcategory` — taxonomia do catálogo
- `price`, `promo_price`, `currency` — comerciais do catálogo
- Documentos (tabela separada, não tocada)
- `processing_instructions` e `ai_context` — vivem só em `resins`, usados pela Dra. LIA; não há colunas-espelho no catálogo

## Entregáveis

1. **Migração SQL idempotente** (`mirror_resins_to_catalog`):
   - UPDATE no `system_a_catalog` usando JOIN por slug e por nome (fallback).
   - Usa `COALESCE(resins.<campo>, catalog.<campo>)` para nunca apagar dado existente do catálogo.
   - Restringe a `product_category ILIKE '%resina%'` para evitar afetar produtos não-resina.
   - Pode rodar quantas vezes for necessário.

2. **Relatório de espelhamento** (SELECT pós-migração) mostrando:
   - Quantos cards foram atualizados
   - Resinas em `resins` sem par no catálogo
   - Cards de catálogo "resina" sem par em `resins` (os 2 órfãos)

3. **Memory** registrando a regra: `resins` é canônica para dados; `system_a_catalog` controla visibilidade pública; documentos ficam em tabelas separadas e não são unificados.

## O que NÃO será feito

- Não mexer em `resin_documents` nem `catalog_documents` (documentos preservados).
- Não apagar, desativar ou renomear nenhum card.
- Não tocar nos 2 órfãos (Direct Aligner, GOWhite) — assunto separado.
- Não criar trigger automático de sync agora (mantemos manual/rerunável até validar).
- Não alterar UI de Configurações > Resinas nem de Catálogo.
