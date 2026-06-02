// zernio-metrics-sync — busca insights por post publicado e atualiza social_posts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ZERNIO_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Pega scope opcional do body
  let onlyPostId: string | null = null;
  if (req.method === 'POST') {
    try { onlyPostId = (await req.json())?.post_id ?? null; } catch { /* ignore */ }
  }

  // Posts publicados nos últimos 30 dias que precisam de refresh (>1h sem sync)
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const stale = new Date(Date.now() - 3600_000).toISOString();

  let q = supabase
    .from('social_posts')
    .select('id, zernio_post_id, platform, analytics_synced_at, published_at')
    .not('zernio_post_id', 'is', null)
    .gte('published_at', since30d)
    .order('published_at', { ascending: false })
    .limit(50);

  if (onlyPostId) {
    q = supabase
      .from('social_posts')
      .select('id, zernio_post_id, platform, analytics_synced_at, published_at')
      .eq('id', onlyPostId)
      .not('zernio_post_id', 'is', null);
  } else {
    q = q.or(`analytics_synced_at.is.null,analytics_synced_at.lt.${stale}`);
  }

  const { data: posts, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!posts || posts.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let updated = 0;
  const errors: any[] = [];

  for (const p of posts) {
    try {
      const res = await fetch(`${ZERNIO_BASE}/posts/${p.zernio_post_id}/insights`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        errors.push({ id: p.id, status: res.status });
        await res.text().catch(() => '');
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const m = data?.insights ?? data?.metrics ?? data ?? {};

      const num = (v: any) => (typeof v === 'number' ? v : Number(v) || 0);
      const patch = {
        likes: num(m.likes ?? m.like_count),
        comments: num(m.comments ?? m.comment_count),
        shares: num(m.shares ?? m.share_count),
        saves: num(m.saves ?? m.saved),
        reach: num(m.reach),
        impressions: num(m.impressions),
        views: num(m.views ?? m.video_views ?? m.plays),
        analytics_synced_at: new Date().toISOString(),
      };
      await supabase.from('social_posts').update(patch).eq('id', p.id);
      updated++;
      console.log(JSON.stringify({ event: 'metrics.ok', post_id: p.id, platform: p.platform }));
    } catch (e: any) {
      errors.push({ id: p.id, error: String(e?.message ?? e) });
      console.error(JSON.stringify({ event: 'metrics.fail', post_id: p.id, error: String(e?.message ?? e) }));
    }
  }

  return new Response(
    JSON.stringify({ processed: posts.length, updated, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});