import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsFilters {
  days: 7 | 30 | 90;
  platform?: string;
}

export function useSocialAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ['social-analytics', filters],
    queryFn: async () => {
      const since = new Date(Date.now() - filters.days * 86400_000).toISOString();
      let q = supabase
        .from('social_posts')
        .select(
          'id, zernio_post_id, platform, caption, media_url, thumbnail_url, post_url, published_at, likes, comments, shares, saves, reach, impressions, views, status, analytics_synced_at',
        )
        .gte('published_at', since)
        .order('published_at', { ascending: false })
        .limit(500);
      if (filters.platform) q = q.eq('platform', filters.platform);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useResyncMetrics() {
  return async (postId?: string) => {
    const { data, error } = await supabase.functions.invoke('zernio-metrics-sync', {
      body: postId ? { post_id: postId } : {},
    });
    if (error) throw error;
    return data;
  };
}