UPDATE smartops_forms
SET slug = regexp_replace(regexp_replace(slug, '^-+|-+$', '', 'g'), '-+', '-', 'g')
WHERE slug ~ '^-' OR slug ~ '-$' OR slug ~ '--';