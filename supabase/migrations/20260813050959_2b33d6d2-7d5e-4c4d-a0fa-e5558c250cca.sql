WITH base AS (
  SELECT f.id,
         btrim(regexp_replace(coalesce(nullif(btrim(f.title), ''), f.name), '^#?\s*-?\s*FORMS\s*-\s*', '', 'i')) AS clean_title,
         c.name AS prod_name,
         nullif(btrim(regexp_replace(coalesce(c.description, ''), '<[^>]+>', ' ', 'g')), '') AS prod_desc,
         nullif(btrim(c.meta_description), '') AS prod_meta,
         nullif(btrim(array_to_string(c.clinical_indications, ', ')), '') AS prod_clin,
         nullif(btrim(array_to_string(c.keywords, ', ')), '') AS prod_kw
  FROM public.smartops_forms f
  LEFT JOIN public.system_a_catalog c ON c.id = f.product_catalog_id
), calc AS (
  SELECT b.*,
         coalesce(nullif(b.prod_name, ''), b.clean_title) AS subject,
         nullif(btrim(split_part(regexp_replace(coalesce(b.prod_desc, ''), '\s+', ' ', 'g'), '. ', 1)), '') AS first_sentence
  FROM base b
)
UPDATE public.smartops_forms f
SET subtitle = left(coalesce(c.prod_meta, c.first_sentence,
        'Fale com um especialista Smart Dent sobre ' || c.subject), 160),
    description = coalesce(
        regexp_replace(c.prod_desc, '\s+', ' ', 'g'),
        c.prod_meta,
        'Conheça ' || c.subject || ' com apoio técnico Smart Dent: especificação correta, treinamento e suporte durante toda a implantação no seu fluxo digital.'
      )
      || coalesce(E'\n\nIndicações: ' || left(regexp_replace(c.prod_clin, '\s+', ' ', 'g'), 300), '')
      || E'\n\nPreencha os campos abaixo para falar com um consultor Smart Dent e receber as condições atuais.',
    seo_description = left(coalesce(c.prod_meta, c.first_sentence,
        'Fale com um especialista Smart Dent sobre ' || c.subject || ' e receba atendimento técnico e condições especiais.'), 155),
    seo_keywords = lower(coalesce(c.prod_kw, c.subject || ', smart dent, odontologia digital'))
FROM calc c
WHERE c.id = f.id;