// flow-executor — avança sessões de social_flows
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1';

function template(str: string, ctx: Record<string, any>): string {
  return (str ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const parts = k.split('.');
    let v: any = ctx;
    for (const p of parts) v = v?.[p];
    return v == null ? '' : String(v);
  });
}

function getByPath(obj: any, path: string) {
  return path.split('.').reduce((a, k) => a?.[k], obj);
}

async function sendDm(apiKey: string, to: string, message: string) {
  const res = await fetch(`${ZERNIO_BASE}/dm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message, platform: 'instagram' }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`dm ${res.status}: ${text}`);
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const zernio = Deno.env.get('ZERNIO_API_KEY');

  let sessionId: string | null = null;
  if (req.method === 'POST') {
    try { sessionId = (await req.json())?.session_id ?? null; } catch { /* ignore */ }
  }

  // Buscar sessões a processar
  let q = supabase.from('social_sessions').select('*, social_flows!inner(id, nodes, edges)').eq('status', 'active');
  if (sessionId) q = q.eq('id', sessionId);
  else q = q.limit(25);

  const { data: sessions, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const results: any[] = [];

  for (const s of sessions ?? []) {
    try {
      const flow: any = (s as any).social_flows;
      const nodes: any[] = flow.nodes ?? [];
      const edges: any[] = flow.edges ?? [];
      let currentId = s.current_node_id;
      const state = { ...(s.state ?? {}) };
      let iterations = 0;

      while (currentId && iterations++ < 20) {
        const node = nodes.find((n: any) => n.id === currentId);
        if (!node) break;
        const type = node.data?.nodeType;
        const cfg = node.data?.config ?? {};

        if (type === 'send_dm' || type === 'send_comment_reply') {
          if (zernio && s.ig_user_id) {
            const msg = template(cfg.message ?? '', state);
            try { await sendDm(zernio, s.ig_user_id, msg); } catch (e) { console.error('dm fail', e); }
          }
        } else if (type === 'wait') {
          const secs = Number(cfg.seconds ?? 60);
          await supabase.from('social_sessions').update({
            current_node_id: currentId,
            state,
            expires_at: new Date(Date.now() + secs * 1000).toISOString(),
          }).eq('id', s.id);
          results.push({ session: s.id, status: 'wait', seconds: secs });
          currentId = null; break;
        } else if (type === 'collect_input') {
          const msg = template(cfg.prompt ?? '', state);
          if (zernio && s.ig_user_id && msg) {
            try { await sendDm(zernio, s.ig_user_id, msg); } catch (e) { console.error('dm fail', e); }
          }
          await supabase.from('social_sessions').update({
            current_node_id: currentId, state, status: 'waiting_input',
          }).eq('id', s.id);
          results.push({ session: s.id, status: 'waiting_input' });
          currentId = null; break;
        } else if (type === 'condition') {
          const val = getByPath(state, cfg.field ?? '');
          const cmp = String(cfg.value ?? '');
          let pass = false;
          if (cfg.op === 'equals') pass = String(val) === cmp;
          else if (cfg.op === 'regex') { try { pass = new RegExp(cmp, 'i').test(String(val ?? '')); } catch { pass = false; } }
          else pass = String(val ?? '').toLowerCase().includes(cmp.toLowerCase());
          const branch = pass ? 'true' : 'false';
          const next = edges.find((e: any) => e.source === currentId && (e.sourceHandle === branch || e.label === branch));
          currentId = next?.target ?? edges.find((e: any) => e.source === currentId)?.target ?? null;
          continue;
        } else if (type === 'set_tag') {
          if (s.ig_user_id && cfg.tag) {
            const { data: c } = await supabase.from('social_contacts').select('tags').eq('ig_user_id', s.ig_user_id).maybeSingle();
            const tags = Array.from(new Set([...(c?.tags ?? []), cfg.tag]));
            await supabase.from('social_contacts').update({ tags }).eq('ig_user_id', s.ig_user_id);
          }
        } else if (type === 'create_lead') {
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/smart-ops-ingest-lead`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
              body: JSON.stringify({
                form_name: cfg.form_name ?? 'social_flow',
                source: 'social_flow',
                ig_user_id: s.ig_user_id,
                ig_username: s.ig_username,
                ...state,
              }),
            });
          } catch (e) { console.error('create_lead fail', e); }
        } else if (type === 'end') {
          await supabase.from('social_sessions').update({ status: 'completed', current_node_id: currentId, state }).eq('id', s.id);
          await supabase.rpc('increment', { table_name: 'social_flows', id_val: flow.id, col: 'total_completed' }).catch(() => null);
          results.push({ session: s.id, status: 'completed' });
          currentId = null; break;
        }

        // próximo nó (sem branching)
        const next = edges.find((e: any) => e.source === currentId && !e.sourceHandle);
        currentId = next?.target ?? null;
      }

      if (!currentId && iterations < 20) {
        await supabase.from('social_sessions').update({ status: 'completed', state }).eq('id', s.id);
      }
    } catch (e: any) {
      console.error(JSON.stringify({ event: 'flow.fail', session: s.id, error: String(e?.message ?? e) }));
      await supabase.from('social_sessions').update({ status: 'failed', state: { ...(s.state ?? {}), error: String(e?.message ?? e) } }).eq('id', s.id);
    }
  }

  return new Response(JSON.stringify({ processed: sessions?.length ?? 0, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});