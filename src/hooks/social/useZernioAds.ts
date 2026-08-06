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

export function useZernioAdCampaigns(filters: AdsFilters) {
  return useQuery({
    queryKey: ['zernio-ad-campaigns', filters],
    queryFn: () =>
      callAds<{ campaigns: ZernioAdCampaign[]; pagination?: { total: number } }>('ads_campaigns', {
        platform: filters.platform,
        status: filters.status,
        days: filters.days,
        limit: 200,
      }),
    staleTime: 5 * 60_000,
  });
}

export function useZernioAds(filters: AdsFilters) {
  return useQuery({
    queryKey: ['zernio-ads', filters],
    queryFn: () =>
      callAds<{ ads: ZernioAd[]; pagination?: { total: number } }>('ads_list', {
        platform: filters.platform,
        status: filters.status,
        days: filters.days,
        limit: 500,
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