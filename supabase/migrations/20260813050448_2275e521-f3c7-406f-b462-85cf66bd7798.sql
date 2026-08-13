ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

-- 1) Remover vídeos de todos os formulários
UPDATE public.smartops_forms
SET media_type = 'image',
    video_id = NULL,
    video_embed_url = NULL,
    video_thumbnail_url = NULL
WHERE media_type = 'video' OR video_embed_url IS NOT NULL OR video_thumbnail_url IS NOT NULL OR video_id IS NOT NULL;

-- 2) Preencher SEO
WITH base AS (
  SELECT f.id,
         btrim(regexp_replace(coalesce(nullif(btrim(f.title), ''), f.name), '^#?\s*-?\s*FORMS\s*-\s*', '', 'i')) AS clean_title,
         c.name AS product_name
  FROM public.smartops_forms f
  LEFT JOIN public.system_a_catalog c ON c.id = f.product_catalog_id
)
UPDATE public.smartops_forms f
SET seo_title = left(b.clean_title || ' | Smart Dent', 60),
    seo_description = left(
      'Fale com um especialista Smart Dent sobre ' || coalesce(nullif(b.product_name, ''), b.clean_title)
      || '. Preencha o formulário e receba atendimento técnico e condições especiais.', 155),
    seo_keywords = lower(coalesce(nullif(b.product_name, ''), b.clean_title)) || ', smart dent, odontologia digital'
FROM base b
WHERE b.id = f.id
  AND (f.seo_title IS NULL OR f.seo_description IS NULL);