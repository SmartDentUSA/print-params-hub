

# Plan: Create company profile documentation (.MD)

## What

Generate a Markdown file at `/mnt/documents/COMPANY_PROFILE_SCHEMA.md` documenting:

1. **All fields in the `CompanyData` interface** (from `src/hooks/useCompanyData.ts`) organized by section (core, business, reviews_reputation, media, corporate, contact, seo, social_media, institutional_links, company_videos)
2. **Data source**: table `system_a_catalog` where `category = 'company_info'`, with fields mapped from `extra_data` JSONB column
3. **All 11 consumer components** that use `useCompanyData()`:
   - `src/components/Footer.tsx` — footer with contact, social links, institutional links
   - `src/components/OrganizationSchema.tsx` — JSON-LD structured data (Organization/LocalBusiness)
   - `src/components/AboutSEOHead.tsx` — SEO meta tags for /sobre page
   - `src/components/SEOHead.tsx` — generic SEO head with company context
   - `src/components/KnowledgeSEOHead.tsx` — knowledge base article SEO
   - `src/components/GoogleReviewsBadge.tsx` — rating star badge
   - `src/components/GoogleReviewsWidget.tsx` — reviews carousel widget
   - `src/pages/About.tsx` — about page UI
   - `src/pages/ProductPage.tsx` — product page SEO
   - `src/pages/CategoryPage.tsx` — category page SEO
   - `src/pages/PublicFormPage.tsx` — public form branding

## Output

Single file `/mnt/documents/COMPANY_PROFILE_SCHEMA.md` with:
- Field inventory table (field, type, example, section)
- Data origin (Supabase table + column mapping)
- Consumer component list with purpose
- Hook location and caching config (30min staleTime)

No code changes to the project.

