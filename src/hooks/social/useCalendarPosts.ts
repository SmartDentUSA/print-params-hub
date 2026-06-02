import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarPost {
  id: string;
  caption: string | null;
  channels: any[];
  media_items: any[];
  scheduled_at: string | null;
  status: string;
  product_name: string | null;
  publish_errors: any;
  source?: 'scheduled' | 'published_history';
  thumbnail_url?: string | null;
  post_url?: string | null;
  platform?: string | null;
}

export function useCalendarPosts(from: Date, to: Date) {
  return useQuery({
    queryKey: ['social-calendar-posts', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<CalendarPost[]> => {
      const [schedRes, pubRes] = await Promise.all([
        supabase
          .from('social_scheduled_posts')
          .select('id, caption, channels, media_items, scheduled_at, status, product_name, publish_errors')
          .gte('scheduled_at', from.toISOString())
          .lte('scheduled_at', to.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('social_posts')
          .select('id, caption, platform, thumbnail_url, media_url, post_url, published_at, format, product_name')
          .gte('published_at', from.toISOString())
          .lte('published_at', to.toISOString())
          .order('published_at', { ascending: true })
          .limit(500),
      ]);
      if (schedRes.error) throw schedRes.error;

      const scheduled: CalendarPost[] = (schedRes.data ?? []).map((p: any) => ({
        ...p,
        channels: Array.isArray(p.channels) ? p.channels : [],
        media_items: Array.isArray(p.media_items) ? p.media_items : [],
        source: 'scheduled' as const,
      }));

      const published: CalendarPost[] = (pubRes.data ?? []).map((p: any) => ({
        id: `pub_${p.id}`,
        caption: p.caption ?? null,
        channels: p.platform ? [{ platform: p.platform, format: p.format }] : [],
        media_items: p.media_url ? [{ url: p.media_url, thumbnail_url: p.thumbnail_url }] : [],
        scheduled_at: p.published_at,
        status: 'published',
        product_name: p.product_name ?? null,
        publish_errors: null,
        source: 'published_history' as const,
        thumbnail_url: p.thumbnail_url ?? null,
        post_url: p.post_url ?? null,
        platform: p.platform ?? null,
      }));

      return [...scheduled, ...published];
    },
  });
}