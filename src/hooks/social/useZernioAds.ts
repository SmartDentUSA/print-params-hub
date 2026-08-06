import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdMetrics {
  spend?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  engagement?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  conversions?: number;
  costPerConversion?: number;
  actions?: Record<string, number>;
  purchaseValue?: number;
  roas?: number;
  lastSyncedAt?: string;
}

export interface ZernioAd {
  _id: string;
  name: string;
  platform: string;
  status: string;
  platformStatus?: string;
  platformAdId: string;
  platformAdSetId?: string;
  platformCampaignId?: string;
  platformAdAccountId?: string;
  platformAdAccountName?: string;
  accountId: string;
  profileId?: string;
  campaignName?: string;
  adSetName?: string;
  goal?: string;
  currency?: string;
  creativeType?: string;
  budget?: { amount?: number; type?: string } | null;
  campaignBudget?: { amount?: number; type?: string } | null;
  budgetLevel?: string;
  creative?: { thumbnailUrl?: string | null; imageUrl?: string | null; videoUrl?: string | null; instagramPermalinkUrl?: string | null; body?: string | null };
  platformCreatedAt?: string;
  metrics?: AdMetrics;
}

export interface ZernioAdCampaign {
  campaignName: string;
  platformCampaignId: string;
  platform: string;
  status: string;
  platformCampaignStatus?: string;
  reviewStatus?: string;
  adCount?: number;
  currency?: string;
  accountId: string;
  platformAdAccountId?: string;
  platformAdAccountName?: string;
  platformObjective?: string;
  budget?: { amount?: number; type?: string } | null;
  campaignBudget?: { amount?: number; type?: string } | null;
  budgetLevel?: string;
  earliestAd?: string;
  latestAd?: string;
  campaignIssuesInfo?: unknown;
  metrics?: AdMetrics;
}

export interface AdsFilters {
  platform?: string;
  status?: string;
  days?: number;
  search?: string;
}

async function callAds<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('social-analytics', {
    body: { action, ...params },
  });
  if (error) throw error;
  return data as T;
}

const PAGE_SIZE = 100; // Zernio limita limit <= 100

async function fetchAllPages<T>(
  action: string,
  key: 'ads' | 'campaigns',
  params: Record<string, unknown>,
  maxPages = 5,
): Promise<T[]> {
  const out: T[] = [];
  let total = Infinity;
  for (let page = 1; page <= maxPages; page++) {
    const res = await callAds<Record<string, unknown>>(action, { ...params, limit: PAGE_SIZE, page });
    const items = (res?.[key] as T[]) ?? [];
    out.push(...items);
    const pagination = res?.pagination as { total?: number } | undefined;
    if (typeof pagination?.total === 'number') total = pagination.total;
    if (items.length < PAGE_SIZE || out.length >= total) break;
  }
  return out;
}

export function useZernioAdCampaigns(filters: AdsFilters) {
  return useQuery({
    queryKey: ['zernio-ad-campaigns', filters],
    queryFn: async () => ({
      campaigns: await fetchAllPages<ZernioAdCampaign>('ads_campaigns', 'campaigns', {
        platform: filters.platform,
        status: filters.status,
        days: filters.days,
      }),
    }),
    staleTime: 5 * 60_000,
  });
}

export function useZernioAds(filters: AdsFilters) {
  return useQuery({
    queryKey: ['zernio-ads', filters],
    queryFn: async () => ({
      ads: await fetchAllPages<ZernioAd>('ads_list', 'ads', {
        platform: filters.platform,
        status: filters.status,
        days: filters.days,
      }, 8),
    }),
    staleTime: 5 * 60_000,
  });
}

export interface DailyInsight {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
}

export function useAdDailyInsights(
  accountId: string | null,
  objectId: string | null,
  level: 'ad' | 'adset' | 'campaign',
  days: number,
) {
  return useQuery({
    queryKey: ['zernio-ad-insights', accountId, objectId, level, days],
    enabled: !!accountId && !!objectId,
    queryFn: () =>
      callAds<{ data: DailyInsight[] }>('ads_insights', {
        accountId,
        objectId,
        level,
        days,
        timeIncrement: 1,
        fields: 'spend,impressions,clicks,ctr,cpc,cpm,reach',
      }),
    staleTime: 5 * 60_000,
  });
}