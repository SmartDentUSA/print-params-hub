// zernio-test-unpublish — despublica posts de teste após a janela definida.
// Marca de teste: social_scheduled_posts.created_by = 'test-blast'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) {
    return Response.json({ ok: false, error: 'ZERNIO_API_KEY ausente' }, { status: 500, headers: corsHeaders });
  }

  let body: { minutes?: number; force?: boolean } = {};
  try { body = req.method === 'POST' ? await req.json() : {}; } catch { /* noop */ }
  const minutes = Number(body.minutes ?? 15);
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();

  const { data: posts, error } = await sb
    .from('social_scheduled_posts')
    .select('id, zernio_post_ids, published_at, status')
    .eq('created_by', 'test-blast')
    .in('status', ['published', 'partial']);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });

  const due = (posts ?? []).filter((p: any) => body.force || (p.published_at && p.published_at <= cutoff));
  const results: any[] = [];

  for (const p of due) {
    const ids = Array.from(new Set(Object.values(p.zernio_post_ids ?? {}).filter(Boolean) as string[]));
    for (const zid of ids) {
      const res = await fetch(`${ZERNIO_BASE}/posts/${zid}/unpublish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      const txt = await res.text();
      results.push({ post_id: p.id, zernio_post_id: zid, status: res.status, body: txt.slice(0, 400) });
      console.log(JSON.stringify({ event: 'unpublish', zid, status: res.status }));
    }
    await sb.from('social_scheduled_posts')
      .update({ status: 'unpublished', updated_at: new Date().toISOString() })
      .eq('id', p.id);
  }

  const remaining = (posts ?? []).length - due.length;
  return Response.json({ ok: true, unpublished_posts: due.length, remaining, results }, { headers: corsHeaders });
});
