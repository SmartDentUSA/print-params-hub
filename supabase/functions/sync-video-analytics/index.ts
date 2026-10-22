import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.25.76';
import { pandaCounters, pandaRetention } from './metrics.ts';

const schema = z.object({ limit: z.number().int().min(1).max(1000).default(50), scheduled: z.boolean().default(false) }).strict();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const pandaKey = Deno.env.get('PANDAVIDEO_API_KEY');
  if (!url || !serviceKey || !anonKey || !pandaKey) return reply({ error: 'Sync is not configured' }, 503);
  let body: unknown;
  try { body = await req.json(); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply({ error: 'Invalid sync parameters' }, 400);
  const { scheduled, limit } = parsed.data;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // External Supabase scheduler uses the project publishable key. This fixed,
  // non-sensitive reconciliation is DB-throttled; it accepts no IDs or URLs.
  if (scheduled) {
    if (req.headers.get('apikey') !== anonKey) return reply({ error: 'Unauthorized' }, 401);
  } else {
    const header = req.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return reply({ error: 'Unauthorized' }, 401);
    const client = createClient(url, anonKey, { global: { headers: { Authorization: header } } });
    const { data: user, error } = await client.auth.getUser(header.slice(7));
    if (error || !user.user) return reply({ error: 'Unauthorized' }, 401);
    const { data: admin } = await db.rpc('is_admin', { user_id: user.user.id });
    if (!admin) return reply({ error: 'Forbidden' }, 403);
  }

  const { data: claimed, error: lockError } = await db.rpc('fn_claim_video_analytics_sync', { p_scheduled: scheduled });
  if (lockError) return reply({ error: 'Sync lock unavailable' }, 503);
  if (!claimed) return reply({ success: true, skipped: true, updated: 0, remaining: 0 });
  let nextCursor: number | null = null;
  try {
    const deadline = Date.now() + 110_000;
    const { data: state } = await db.from('cron_state').select('meta').eq('key', 'panda_analytics_sync').single();
    const cursor = scheduled ? Math.max(0, Number(state?.meta?.cursor) || 0) : 0;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = db.from('knowledge_videos').select('id,pandavideo_id,analytics_avg_retention,analytics_unique_views,analytics_unique_plays', { count: 'exact' }).not('pandavideo_id', 'is', null);
    query = scheduled ? query.order('id').range(cursor, cursor + 999) : query.or(`analytics_last_sync.is.null,analytics_last_sync.lt.${cutoff}`).order('analytics_last_sync', { ascending: true, nullsFirst: true }).limit(limit);
    const { data: videos, error, count } = await query;
    if (error) throw error;
    if (!videos?.length) { nextCursor = scheduled ? 0 : null; return reply({ success: true, updated: 0, remaining: 0, total: count || 0 }); }
    const { data: maxData } = await db.from('knowledge_videos').select('analytics_unique_views,analytics_unique_plays').not('analytics_unique_views', 'is', null).order('analytics_unique_views', { ascending: false }).limit(1).maybeSingle();
    let maxViews = Number(maxData?.analytics_unique_views) || 1;
    let maxPlays = Number(maxData?.analytics_unique_plays) || 1;
    let position = 0, processed = 0, updated = 0, failed = 0;
    const fetchPanda = async (kind: string, id: string) => {
      try {
        const response = await fetch(`https://data.pandavideo.com/${kind}/${encodeURIComponent(id)}`, { headers: { Authorization: pandaKey }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) { console.warn(`[PandaAnalytics] ${kind} HTTP ${response.status}`); return null; }
        return await response.json();
      } catch { console.warn(`[PandaAnalytics] ${kind} unavailable`); return null; }
    };
    const worker = async () => {
      while (position < videos.length && Date.now() < deadline) {
        const index = position++;
        const video = videos[index];
        const [general, retentionData] = await Promise.all([fetchPanda('general', video.pandavideo_id), fetchPanda('retention', video.pandavideo_id)]);
        const counters = pandaCounters(general);
        processed++;
        if (!counters) { failed++; continue; }
        const retention = pandaRetention(retentionData) ?? Number(video.analytics_avg_retention || 0);
        const playRate = counters.views > 0 ? Number((counters.plays / counters.views * 100).toFixed(2)) : 0;
        maxViews = Math.max(maxViews, counters.unique_views);
        maxPlays = Math.max(maxPlays, counters.unique_plays);
        const scoreBase = (playRate / 100 * .3 + retention / 100 * .35 + Math.min(1, counters.unique_views / maxViews) * .2 + Math.min(1, counters.unique_plays / maxPlays) * .15) * 100;
        const score = Number((scoreBase * (retention < 25 ? .7 : 1)).toFixed(2));
        const { error: writeError } = await db.from('knowledge_videos').update({ analytics_views: counters.views, analytics_unique_views: counters.unique_views, analytics_plays: counters.plays, analytics_unique_plays: counters.unique_plays, analytics_play_rate: playRate, analytics_avg_retention: retention, relevance_score: score, analytics_last_sync: new Date().toISOString() }).eq('id', video.id);
        if (writeError) { failed++; continue; }
        updated++;
        const { error: logError } = await db.from('knowledge_video_metrics_log').insert({ knowledge_video_id: video.id, pandavideo_id: video.pandavideo_id, ...counters, play_rate: playRate, avg_retention: retention, relevance_score: score });
        if (logError) console.warn('[PandaAnalytics] metric history write failed');
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (scheduled) nextCursor = cursor + processed >= (count || 0) ? 0 : cursor + processed;
    console.info(`[PandaAnalytics] processed=${processed} updated=${updated} failed=${failed}`);
    return reply({ success: failed === 0, updated, failed, remaining: Math.max(0, (count || 0) - updated), total: count || 0, processed });
  } catch {
    console.error('[PandaAnalytics] sync failed');
    return reply({ error: 'Video analytics sync failed', success: false }, 500);
  } finally {
    const { error } = await db.rpc('fn_finish_video_analytics_sync', { p_cursor: nextCursor });
    if (error) console.warn('[PandaAnalytics] lock release failed');
  }
});