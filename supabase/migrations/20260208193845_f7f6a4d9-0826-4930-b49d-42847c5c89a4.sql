UPDATE knowledge_videos
SET title = TRIM(BOTH FROM regexp_replace(
    regexp_replace(title, '\.mp4$', '', 'i'),
    '^.*Depoimento\s*-\s*', '', 'i'
  ))
WHERE title ~* 'Depoimento'
  AND video_type = 'pandavideo';