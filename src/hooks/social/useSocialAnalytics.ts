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
      const sinceMs = Date.now() - filters.days * 86400_000;
      let q = supabase
        .from('social_posts')
        .select(
          'id, zernio_post_id, platform, caption, media_url, thumbnail_url, post_url, published_at, scheduled_at, created_at, likes, comments, shares, saves, reach, impressions, views, status, analytics_synced_at',
        )
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.platform) q = q.eq('platform', filters.platform);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((x: any) => ({
        ...x,
        effective_at: x.published_at ?? x.scheduled_at ?? x.created_at ?? null,
      }));
      return rows.filter((x) => {
        if (!x.effective_at) return false;
        return new Date(x.effective_at).getTime() >= sinceMs;
      });
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