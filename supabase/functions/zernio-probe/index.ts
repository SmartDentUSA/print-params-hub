import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(async (req) => {
  const key = Deno.env.get('ZERNIO_API_KEY');
  const { paths = [] } = await req.json().catch(() => ({ paths: [] }));
  const out: Record<string, unknown> = {};
  for (const p of paths as string[]) {
    try {
      const res = await fetch(`https://zernio.com/api${p}`, { headers: { Authorization: `Bearer ${key}` } });
      out[p] = { status: res.status, body: (await res.text()).slice(0, 1500) };
    } catch (e) { out[p] = { error: String(e) }; }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { 'Content-Type': 'application/json' } });
});
