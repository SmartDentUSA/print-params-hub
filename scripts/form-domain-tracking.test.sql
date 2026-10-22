-- Read-only regression: expected form match must hold across old and new domains.
WITH cases(input, expected) AS (VALUES
  ('https://parametros.smartdent.com.br/f/t-marker', '/f/t-marker'),
  ('https://smartdent.com.br/f/t-marker', '/f/t-marker'),
  ('https://www.smartdent.com.br/f/t-marker?utm_source=ig', '/f/t-marker'),
  ('https://admin.smartdent.com.br/lp/t-marker/', '/lp/t-marker'),
  ('/f/lp/t-marker', '/f/lp/t-marker')
), normalized AS (
  SELECT input, expected, regexp_replace(split_part(split_part(regexp_replace(input,
    '^https?://(parametros\.|www\.|admin\.)?smartdent\.com\.br(?=/|$)', '', 'i'), '?', 1), '#', 1), '/+$', '') AS actual FROM cases
)
SELECT input, actual = expected AND actual IN ('/f/t-marker', '/f/lp/t-marker', '/lp/t-marker') AS passed FROM normalized;