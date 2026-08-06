// social-analytics — proxy dos endpoints de Analytics do Zernio (posting + inbox)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// action -> [path, allowed query params]
const ROUTES: Record<string, [string, string[]]> = {
  posts: ['/analytics', ['postId', 'platform', 'profileId', 'accountId', 'source', 'fromDate', 'toDate', 'limit', 'page', 'sortBy', 'order']],
  daily_metrics: ['/analytics/daily-metrics', ['platform', 'profileId', 'accountId', 'fromDate', 'toDate', 'source', 'attribution']],
  best_time: ['/analytics/best-time', ['platform', 'profileId', 'accountId', 'source']],
  posting_frequency: ['/analytics/posting-frequency', ['platform', 'profileId', 'accountId', 'source']],
  content_decay: ['/analytics/content-decay', ['platform', 'profileId', 'accountId', 'source']],
  follower_stats: ['/accounts/follower-stats', ['accountIds', 'profileId', 'fromDate', 'toDate', 'granularity']],
  inbox_volume: ['/analytics/inbox/volume', ['fromDate', 'toDate', 'profileId', 'platform', 'accountId', 'source']],
  inbox_heatmap: ['/analytics/inbox/heatmap', ['fromDate', 'toDate', 'profileId', 'platform', 'accountId', 'source', 'action_type']],
  inbox_response_time: ['/analytics/inbox/response-time', ['fromDate', 'toDate', 'profileId', 'platform', 'accountId']],
  inbox_source_breakdown: ['/analytics/inbox/source-breakdown', ['fromDate', 'toDate', 'profileId', 'platform', 'accountId']],
  inbox_top_accounts: ['/analytics/inbox/top-accounts', ['fromDate', 'toDate', 'profileId', 'platform', 'source', 'limit']],
  // ── Ads (Meta/Google via Zernio) ──
  ads_list: ['/ads', ['platform', 'profileId', 'accountId', 'status', 'campaignName', 'adSetName', 'search', 'days', 'fromDate', 'toDate', 'limit', 'page', 'sortBy', 'order']],
  ads_campaigns: ['/ads/campaigns', ['platform', 'profileId', 'accountId', 'status', 'search', 'days', 'fromDate', 'toDate', 'limit', 'page', 'sortBy', 'order']],
  ads_insights: ['/ads/insights', ['accountId', 'objectId', 'level', 'days', 'fromDate', 'toDate', 'fields', 'timeIncrement', 'after']],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('ZERNIO_API_KEY');
  if (!key) return json({ error: 'ZERNIO_API_KEY não configurada' }, 500);

  let payload: Record<string, unknown> = {};
  try { payload = req.method === 'POST' ? await req.json() : {}; } catch { /* ignore */ }

  const url = new URL(req.url);
  const action = String(payload.action ?? url.searchParams.get('action') ?? '');
  const route = ROUTES[action];
  if (!route) return json({ error: `action desconhecida: ${action || '(vazia)'}` }, 400);

  const [path, allowed] = route;
  const qs = new URLSearchParams();
  for (const p of allowed) {
    let raw = payload[p];
    if (raw === undefined || raw === null || raw === '' || raw === 'all') continue;
    // Zernio aceita no máximo limit=100
    if (p === 'limit') {
      const n = Number(raw);
      raw = Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 100) : 100;
    }
    // heatmap usa "action" como nome de param no Zernio; recebemos como action_type
    qs.set(p === 'action_type' ? 'action' : p, String(raw));
  }

  try {
    const res = await fetch(`${ZERNIO_BASE}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[social-analytics] zernio ${path} -> ${res.status}: ${text}`);
      return json({ error: 'Zernio request failed', status: res.status, details: text }, res.status);
    }
    return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[social-analytics] fail', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});