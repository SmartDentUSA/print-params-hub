UPDATE public.knowledge_contents kc
SET og_image_url = t.thumbnail_url
FROM public.training_testimonials t
WHERE t.knowledge_content_id = kc.id
  AND t.thumbnail_url IS NOT NULL
  AND (kc.og_image_url IS NULL OR kc.og_image_url = '');

UPDATE public.knowledge_videos kv
SET thumbnail_url = t.thumbnail_url,
    video_duration_seconds = COALESCE(kv.video_duration_seconds, t.duration_seconds)
FROM public.training_testimonials t
WHERE t.knowledge_content_id = kv.content_id
  AND kv.source = 'training_testimonial'
  AND t.thumbnail_url IS NOT NULL
  AND kv.thumbnail_url IS NULL;