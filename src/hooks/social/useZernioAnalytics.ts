import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ZernioAnalyticsFilters {
  days: number;
  platform?: string;
  accountId?: string;
  source?: string;
}

export function dateRange(days: number) {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { fromDate: iso(from), toDate: iso(to) };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('social-analytics', { body });
  if (error) throw new Error(error.message);
  const d = data as any;
  if (d?.error) throw new Error(d.details ? `${d.error} (${d.status})` : String(d.error));
  return data as T;
}

function useZernio<T>(action: string, params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ['zernio-analytics', action, params],
    queryFn: () => call<T>({ action, ...params }),
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
  });
}

const base = (f: ZernioAnalyticsFilters) => ({
  platform: f.platform,
  accountId: f.accountId,
  source: f.source,
});

export interface PostRow {
  postId: string;
  content?: string;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  thumbnailUrl?: string | null;
  platformAnalytics?: Array<{ platform: string; platformPostUrl?: string | null; analytics?: Record<string, number> }>;
  analytics?: Record<string, number>;
}

export function usePostAnalytics(f: ZernioAnalyticsFilters) {
  return useZernio<{
    overview?: Record<string, number>;
    posts?: PostRow[];
    accounts?: Array<{ _id?: string; platform?: string; username?: string; displayName?: string; followerCount?: number }>;
    hasAnalyticsAccess?: boolean;
  }>('posts', { ...base(f), ...dateRange(f.days), limit: 100, sortBy: 'engagement', order: 'desc' });
}

export function useDailyMetrics(f: ZernioAnalyticsFilters) {
  return useZernio<{
    dailyData?: Array<{ date: string; postCount: number; platforms?: Record<string, number>; metrics: Record<string, number> }>;
    platformBreakdown?: Array<Record<string, any>>;
  }>('daily_metrics', { ...base(f), ...dateRange(f.days), attribution: 'received' });
}

export function useBestTime(f: ZernioAnalyticsFilters) {
  return useZernio<{ slots?: Array<{ day_of_week: number; hour: number; avg_engagement: number; post_count: number }> }>(
    'best_time',
    base(f),
  );
}

export function usePostingFrequency(f: ZernioAnalyticsFilters) {
  return useZernio<{ data?: any[]; rows?: any[]; frequencies?: any[] }>('posting_frequency', base(f));
}

export function useContentDecay(f: ZernioAnalyticsFilters) {
  return useZernio<{ buckets?: Array<{ bucket_order: number; bucket_label: string; avg_pct_of_final: number; post_count: number }> }>(
    'content_decay',
    base(f),
  );
}

export function useFollowerStats(f: ZernioAnalyticsFilters) {
  return useZernio<{ accounts?: any[]; stats?: Record<string, any> }>('follower_stats', {
    ...dateRange(f.days),
    granularity: 'daily',
  });
}

export function useInboxVolume(f: ZernioAnalyticsFilters) {
  return useZernio<{
    summary?: { received: number; sent: number; read: number; failed: number; uniqueConversations: number };
    timeseries?: Array<{ date: string; sent: number; received: number; read: number; failed: number }>;
    byPlatform?: Array<{ platform: string; sent: number; received: number; read: number; failed: number }>;
  }>('inbox_volume', { ...base(f), ...dateRange(f.days) });
}

export function useInboxHeatmap(f: ZernioAnalyticsFilters) {
  return useZernio<{ buckets?: Array<{ dow: number; hour: number; received: number; sent: number; read: number }> }>(
    'inbox_heatmap',
    { ...base(f), ...dateRange(f.days) },
  );
}

export function useInboxResponseTime(f: ZernioAnalyticsFilters) {
  return useZernio<{
    summary?: { sampleSize: number; medianSeconds: number; p90Seconds: number; p99Seconds: number; meanSeconds: number };
    histogram?: Array<{ bucket: string; count: number }>;
  }>('inbox_response_time', { platform: f.platform, accountId: f.accountId, ...dateRange(f.days) });
}

export function useInboxSourceBreakdown(f: ZernioAnalyticsFilters) {
  return useZernio<{ sources?: Array<{ source: string; received: number; sent: number; read: number }> }>(
    'inbox_source_breakdown',
    { platform: f.platform, accountId: f.accountId, ...dateRange(f.days) },
  );
}

export function useInboxTopAccounts(f: ZernioAnalyticsFilters) {
  return useZernio<{
    accounts?: Array<{ accountId: string; platform: string; displayName: string; username: string; received: number; sent: number; total: number; conversations: number }>;
  }>('inbox_top_accounts', { platform: f.platform, source: f.source, ...dateRange(f.days), limit: 20 });
}