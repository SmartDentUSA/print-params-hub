# Knowledge base SEO integrity — 2026-10-08

## Changes

- Helmet owns route metadata from the initial HTML, avoiding duplicate canonical and description tags.
- The article viewer is the single source of article metadata; closing it restores the knowledge-base head. Localized visible text is also used for metadata.
- Article text excludes scripts and styles. Browser extraction also excludes hidden editorial layers.
- Catalog expertise/keywords accept either arrays or delimited strings, avoiding character-by-character schemas.
- Article, video and ebook cards expose crawlable links, preserve modifier-click navigation and keyboard activation.
- Lists read ordered 200-row batches instead of trusting a limit above the API row cap.
- Removed generic claims of practical testing, fabricated five-star technical reviews, generated citations and unverified review dates/reviewer attribution.
- The SEO proxy also excludes scripts/styles from article text and no longer fabricates review attribution.

## Verification

- `node scripts/verify-knowledge-seo.mjs`: pass (terms, 640 rows, cancellation, errors, server text).
- `tsc --noEmit -p tsconfig.app.json`: pass.
- `vite build`: pass; existing CSS import ordering and large chunk warnings remain.
- Browser: 76 article links; one canonical and description on hub and article; canonical/title restored on close; event schema valid JSON, no CSS in articleBody; Organization knowsAbout contains 26 terms, not hundreds of characters.
- Video list: 500 cards. Database contains 501 active content records with video, of which one is an ebook. Therefore 500 is the expected video-tab count, not proof of truncation.

## Sidebar follow-up (2026-10-08)

- Sidebar counts now classify active, categorized records by ebook first, then video presence, then article, matching the list queries. Categories come from that tab's actual records rather than a fixed subset.
- Article "All" includes technical-parameter articles. Database and local browser both show 126 articles; the sidebar also shows 126. Videos total 500; the Technology video filter renders 36 cards and its sidebar count is 36.
- Changing the sidebar category clears stale chips/search so an earlier chip cannot silently override the chosen category.
- TypeScript, the existing pagination/SEO verification script and Vite production build passed. Existing CSS import-order and chunk-size warnings remain.
- Editorial corrections were applied separately to 179 knowledge records with original-field hash guards; 476 changed fields were verified after normalizing line endings. No remaining bare-hash links in PT/EN/ES; all 14 ebooks received three-language summaries. Source PDFs remain unchanged. This is not a claim of complete clinical/regulatory validation.

## Environment

The existing package-lock.json does not match package.json, so npm ci fails before these changes. Validation used npm install without modifying the lockfile, then installed @swc/core 1.13.2 and @supabase/supabase-js 2.57.0 (versions already recorded in the lockfile). Newer SWC could not load with this machine's cache ACLs. No package manifest or lockfile changes are included.

## Production content corrections (separate from code deployment)

Backup stored locally before edits; updates guarded against concurrent changes. Verified after updates:
- Corrected Expodental URL in smart-dent-eventos-congressos-2026.
- Replaced administrative Loja Integrada URL with verified public https://loja.smartdent.com.br/glazeon in three articles (smart-print-bio-vitality-resina-3d-fda-para-restauracoes, glazeon-splint-passo-a-passo-aplicacao, glazeon-splint-acabamento-3d-eficiente-e-duravel).
- Corrected canonical_url and cta_1_url for GlazeON in Sistema B's catalog. Sistema A was not edited; an upstream sync could reintroduce its old values.

## Remaining work before claiming comprehensive quality

Database inventory: 849 records, 640 active, 14 ebooks, 501 active records with video (overlap with ebooks). Structural scan of all active Portuguese records: 96 with placeholder links, 48 without author, 11 without meta description, 12 with very short HTML. Missing author is a review flag, not automatically a violation for institutional pages. Raw HTML length is approximate and not a quality score.

Clinical/regulatory inconsistencies, source documents, PDF contents, translations, embedded JSON-LD in stored HTML, relevant internal linking, duplicates and ebook summaries still require editorial validation. Neither this patch nor the inventory certifies all content. Search Console, analytics, real-user performance and backlinks remain unverified. Code changes require frontend deployment and a separate seo-proxy deployment; no automatic deployment is claimed.
