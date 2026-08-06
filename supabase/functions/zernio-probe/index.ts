import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(async (req) => {
  const key = Deno.env.get('ZERNIO_API_KEY');
  const { paths = [], mode = 'keys' } = await req.json().catch(() => ({}));
  const out: Record<string, unknown> = {};
  for (const p of paths as string[]) {
    try {
      const res = await fetch(`https://zernio.com/api${p}`, { headers: { Authorization: `Bearer ${key}` } });
      const t = await res.text();
      let j: any = null; try { j = JSON.parse(t); } catch { /**/ }
      if (mode === 'keys' && j) {
        const shape = (v: any, d = 0): any => {
          if (Array.isArray(v)) return [v.length, d < 3 ? shape(v[0], d + 1) : '…'];
          if (v && typeof v === 'object') {
            if (d >= 3) return Object.keys(v);
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, d + 1)]));
          }
          return typeof v === 'string' ? String(v).slice(0, 40) : v;
        };
        out[p] = { status: res.status, shape: shape(j) };
      } else out[p] = { status: res.status, body: t.slice(0, 3000) };
    } catch (e) { out[p] = { error: String(e) }; }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { 'Content-Type': 'application/json' } });
});
