UPDATE public.resins
SET description = trim(regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(description, '<(style|script)[^<]*</\1>', ' ', 'gi'),
      '<[^>]+>', ' ', 'g'
    ),
    '&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;', ' ', 'gi'
  ),
  '\s+', ' ', 'g'
))
WHERE description ~ '<[a-zA-Z]+';