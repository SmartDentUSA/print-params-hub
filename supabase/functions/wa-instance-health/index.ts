// wa-instance-health — checa se cada instância Evolution Go está com sessão ativa.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await sb
    .from('team_members')
    .select('evolution_instance_name, evo_go_instance_token, evo_go_base_url, ativo')
    .not('evo_go_instance_token', 'is', null)
    .eq('ativo', true);

  const seen = new Set<string>();
  const out: any[] = [];
  for (const tm of (data ?? []) as any[]) {
    const name = tm.evolution_instance_name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const base = String(tm.evo_go_base_url ?? 'http://82.25.75.61:8081').replace(/\/$/, '');
    const paths = ['/instance/status', '/session/status'];
    let result: any = { instance: name, base, checks: [] as any[] };
    for (const p of paths) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${base}${p}`, {
          headers: { apikey: tm.evo_go_instance_token },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        result.checks.push({ path: p, status: res.status, body: (await res.text()).slice(0, 300) });
      } catch (e) {
        result.checks.push({ path: p, error: String((e as Error).message) });
      }
    }
    out.push(result);
  }
  return Response.json({ ok: true, instances: out }, { headers: corsHeaders });
});
