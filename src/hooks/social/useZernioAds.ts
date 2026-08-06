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
  maxPages = 10,
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
      }, 10),
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
// ---------------------------------------------------------------------------
// Métricas do PERÍODO (Zernio /ads e /ads/campaigns retornam métricas LIFETIME).
// Usamos /ads/insights com fromDate/toDate por conta de anúncios.
// ---------------------------------------------------------------------------

export interface PeriodMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr?: number;
  cpc?: number;
}

export interface AdAccountRef {
  accountId: string;
  platformAdAccountId: string;
  platform: string;
}

const LEAD_ACTION_TYPES = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
]);

function num(v: unknown) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function leadsFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let best = 0;
  for (const a of actions as Array<{ action_type?: string; value?: string }>) {
    if (a?.action_type && LEAD_ACTION_TYPES.has(a.action_type)) best = Math.max(best, num(a.value));
  }
  return best;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/** Insights agregados no período, por campanha (chave = platformCampaignId). */
export function useAdsPeriodInsights(accounts: AdAccountRef[], days: number) {
  // Zernio só expõe insights por conta para Meta/Facebook hoje.
  const supported = accounts.filter((a) => a.platform === 'facebook' && a.platformAdAccountId);
  const key = supported.map((a) => `${a.accountId}:${a.platformAdAccountId}`).sort().join('|');

  return useQuery({
    queryKey: ['zernio-ads-period', key, days],
    enabled: supported.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const fromDate = isoDaysAgo(days);
      const toDate = new Date().toISOString().slice(0, 10);
      const results = await Promise.allSettled(
        supported.map((a) =>
          callAds<{ data: Array<Record<string, unknown>> }>('ads_insights', {
            accountId: a.accountId,
            objectId: a.platformAdAccountId,
            level: 'campaign',
            fromDate,
            toDate,
            fields: 'campaign_id,spend,impressions,clicks,ctr,cpc,actions',
          }),
        ),
      );
      const byCampaign = new Map<string, PeriodMetrics>();
      const totals: PeriodMetrics = { spend: 0, impressions: 0, clicks: 0, leads: 0 };
      let covered = 0;
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        covered++;
        for (const row of r.value?.data ?? []) {
          const id = String(row.campaign_id ?? '');
          const m: PeriodMetrics = {
            spend: num(row.spend),
            impressions: num(row.impressions),
            clicks: num(row.clicks),
            leads: leadsFromActions(row.actions),
            ctr: row.ctr !== undefined ? num(row.ctr) : undefined,
            cpc: row.cpc !== undefined ? num(row.cpc) : undefined,
          };
          if (id) byCampaign.set(id, m);
          totals.spend += m.spend;
          totals.impressions += m.impressions;
          totals.clicks += m.clicks;
          totals.leads += m.leads;
        }
      }
      return { byCampaign, totals, fromDate, toDate, covered, requested: supported.length };
    },
  });
}

// ---------------------------------------------------------------------------
// Receita (propostas ganhas) por campanha — vem do CRM (deals ganhas), não da Zernio.
// ---------------------------------------------------------------------------

export function useCampaignRevenue(days: number) {
  const fromDate = isoDaysAgo(days);
  const toDate = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['campaign-revenue', fromDate, toDate],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_campaign_revenue', {
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) throw error;
      const byCampaign = new Map<string, { revenue: number; wonDeals: number }>();
      let total = 0;
      for (const row of (data ?? []) as Array<{ platform_campaign_id: string; revenue: number; won_deals: number }>) {
        const revenue = num(row.revenue);
        byCampaign.set(String(row.platform_campaign_id), { revenue, wonDeals: num(row.won_deals) });
        total += revenue;
      }
      return { byCampaign, total, fromDate, toDate };
    },
  });
}
