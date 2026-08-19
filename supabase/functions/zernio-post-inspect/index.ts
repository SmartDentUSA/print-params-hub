// zernio-post-inspect — diagnóstico: lê um post no Zernio e sonda postTypes aceitos.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) return Response.json({ error: 'ZERNIO_API_KEY ausente' }, { status: 500, headers: corsHeaders });

  let body: { post_id?: string; probe_post_type?: string; account_id?: string; raw_payload?: unknown } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const out: Record<string, unknown> = {};

  if (body.raw_payload) {
    const res = await fetch(`${ZERNIO_BASE}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body.raw_payload),
    });
    out.raw = { status: res.status, body: (await res.text()).slice(0, 4000) };
  }

  if (body.post_id) {
    const res = await fetch(`${ZERNIO_BASE}/posts/${body.post_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    out.get_post = { status: res.status, body: (await res.text()).slice(0, 4000) };
  }

  if (body.probe_post_type) {
    const res = await fetch(`${ZERNIO_BASE}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'probe',
        publishNow: false,
        platforms: [{ platform: 'instagram', accountId: body.account_id ?? 'invalid', postType: body.probe_post_type }],
      }),
    });
    out.probe = { status: res.status, body: (await res.text()).slice(0, 2000) };
  }

  return Response.json(out, { headers: corsHeaders });
});