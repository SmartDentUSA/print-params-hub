import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('ZERNIO_API_KEY');
  const body = await req.json().catch(() => ({}));
  const path = body?.path ?? '/comment-automations';
  const r = await fetch(`https://zernio.com/api/v1${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const t = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: t.slice(0, 4000) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
