---
name: Padrão único de formatação + FAQ AEO
description: Toda publicação da Base de Conhecimento usa _shared/article-format.ts (formatação padrão + FAQs SEO/AEO); legado é normalizado por knowledge-content-modernize
type: feature
---
- `supabase/functions/_shared/article-format.ts` é a ÚNICA fonte do padrão de formatação HTML (`STANDARD_FORMAT_PROMPT`) e das premissas de FAQ (`AEO_FAQ_PROMPT`).
- FAQ AEO: resposta direta na 1ª frase, 40-90 palavras, entidades nomeadas, sem preço/promessa, e cobertura de intenção de decisão ("vale a pena investir no digital", "é rentável", "melhor empresa para comprar scanner/impressora", primeiros passos, necessidade de treinamento, recorte geográfico). 5 a 7 FAQs.
- `reformat-article-html` aplica formatação + regenera FAQs (`withFaqs`, default true); grava `content_html_reformatted_at` e `faqs_aeo_at`.
- `knowledge-content-modernize` reescreve conteúdo LEGADO no prompt editorial novo ancorado só no texto existente; preserva ficha do participante, transcrição completa, JSON-LD, título e slug; pula conteúdo do pipeline novo (`draft_metadata.generated_at` + created_at >= 2026-08-01) salvo `force`; grava `content_modernized_at`.
- Publicação nova (copilot-publish-knowledge-article e training-testimonial-publish) dispara `reformat-article-html` fire-and-forget → conteúdo novo já nasce no padrão.
- UI: Admin > Reformatar HTML de Artigos tem os lotes "Reformatar" e "Modernizar (prompt novo)" (sequencial, 1 por vez, via `reformatBatchRunner`).
