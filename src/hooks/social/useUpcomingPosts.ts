import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUpcomingPosts() {
  return useQuery({
    queryKey: ['social-upcoming-posts'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7d = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [upcomingRes, recentRes] = await Promise.all([
        supabase
          .from('social_scheduled_posts')
          .select('id, caption, channels, media_items, scheduled_at, status, product_name, published_at, updated_at')
          .in('status', ['scheduled', 'publishing', 'failed'])
          .gte('scheduled_at', now)
          .lte('scheduled_at', in7d)
          .order('scheduled_at', { ascending: true })
          .limit(20),
        supabase
          .from('social_scheduled_posts')
          .select('id, caption, channels, media_items, scheduled_at, status, product_name, published_at, updated_at')
          .in('status', ['published', 'publishing'])
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);
      if (upcomingRes.error) throw upcomingRes.error;
      if (recentRes.error) throw recentRes.error;

      const byId = new Map<string, any>();
      for (const r of [...(upcomingRes.data ?? []), ...(recentRes.data ?? [])]) {
        if (!byId.has(r.id)) {
          byId.set(r.id, {
            ...r,
            scheduled_at: r.scheduled_at ?? r.published_at ?? r.updated_at,
          });
        }
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      );
    },
  });
}