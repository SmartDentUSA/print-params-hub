import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSocialMetrics() {
  return useQuery({
    queryKey: ['social-metrics'],
    queryFn: async () => {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [pubScheduledRes, pubHistoryRes, todayRes, schedRes, failRes, lastSyncRes] = await Promise.all([
        supabase.from('social_scheduled_posts').select('id', { count: 'exact', head: true })
          .eq('status', 'published').gte('published_at', startMonth),
        supabase.from('social_posts').select('id', { count: 'exact', head: true })
          .gte('published_at', startMonth),
        supabase.from('social_posts').select('id', { count: 'exact', head: true })
          .gte('published_at', startToday),
        supabase.from('social_scheduled_posts').select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', in7d),
        supabase.from('social_scheduled_posts').select('id', { count: 'exact', head: true })
          .eq('status', 'failed'),
        supabase.from('social_posts').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      return {
        published: Math.max(pubScheduledRes.count ?? 0, pubHistoryRes.count ?? 0),
        publishedToday: todayRes.count ?? 0,
        scheduled: schedRes.count ?? 0,
        failed: failRes.count ?? 0,
        lastSync: (lastSyncRes.data as any)?.updated_at ?? null,
      };
    },
    refetchInterval: 60_000,
  });
}