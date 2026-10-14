alter table public.professional_courses add column if not exists reels_video_url text;
comment on column public.professional_courses.video_url is 'Vídeo horizontal: apresentação do curso pelo KOL';
comment on column public.professional_courses.reels_video_url is 'Vídeo vertical (9:16) para publicação nos Reels Smart Dent';