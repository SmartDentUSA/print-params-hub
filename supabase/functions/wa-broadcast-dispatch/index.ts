// wa-broadcast-dispatch — resolve segmento de broadcast e dispara via Evolution
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function template(str: string, ctx: Record<string, any>): string {
  return (str ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => String(ctx?.[k] ?? ''));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const broadcastId = body?.broadcast_id;

  if (broadcastId) {
    return await dispatch(supabase, broadcastId);
  }

  // Cron mode: scheduled broadcasts
  const { data: scheduled } = await supabase.from('social_broadcasts').select('id').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()).limit(5);
  const results: any[] = [];
  for (const b of scheduled ?? []) {
    const r = await dispatch(supabase, b.id);
    results.push(await r.json().catch(() => ({})));
  }
  return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

async function dispatch(supabase: any, broadcastId: string): Promise<Response> {
  const { data: b } = await supabase.from('social_broadcasts').select('*').eq('id', broadcastId).single();
  if (!b) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  await supabase.from('social_broadcasts').update({ status: 'dispatching' }).eq('id', broadcastId);

  const seg: any = b.segment ?? {};
  const message: string = seg.message ?? '';

  // Query lia_attendances pelo segmento
  let q = supabase.from('lia_attendances').select('id, name, phone, lead_status, tags').is('merged_into', null).not('phone', 'is', null).limit(500);
  if (seg.lead_status) q = q.eq('lead_status', seg.lead_status);
  if (Array.isArray(seg.tags) && seg.tags.length > 0) q = q.overlaps('tags', seg.tags);

  const { data: leads, error } = await q;
  if (error) {
    await supabase.from('social_broadcasts').update({ status: 'failed', segment: { ...seg, error: error.message } }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Pega instância Evolution default (primeira ativa)
  const { data: tm } = await supabase.from('team_members').select('evolution_instance_name, evolution_api_key, evolution_phone').eq('ativo', true).not('evolution_api_key', 'is', null).limit(1).single();
  if (!tm) {
    await supabase.from('social_broadcasts').update({ status: 'failed', segment: { ...seg, error: 'no_evolution_instance' } }).eq('id', broadcastId);
    return new Response(JSON.stringify({ error: 'no_evolution_instance' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const evoBase = `https://evolution.smartdent.com.br/message/sendText/${tm.evolution_instance_name}`;
  let sent = 0; const errors: any[] = [];

  for (const lead of leads ?? []) {
    try {
      const firstName = (lead.name ?? '').split(' ')[0] ?? '';
      const text = template(message, { first_name: firstName, name: lead.name ?? '' });
      const phone = String(lead.phone).replace(/\D/g, '');
      const res = await fetch(evoBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: tm.evolution_api_key },
        body: JSON.stringify({ number: phone, text }),
      });
      if (!res.ok) { errors.push({ id: lead.id, status: res.status }); await res.text().catch(() => ''); continue; }
      await res.json().catch(() => ({}));
      sent++;
      // jitter anti-ban: 1-3s
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    } catch (e: any) {
      errors.push({ id: lead.id, error: String(e?.message ?? e) });
    }
  }

  await supabase.from('social_broadcasts').update({
    status: 'sent',
    total_sent: sent,
    segment: { ...seg, errors_count: errors.length, total_targets: leads?.length ?? 0 },
  }).eq('id', broadcastId);

  console.log(JSON.stringify({ event: 'broadcast.done', id: broadcastId, sent, errors: errors.length }));
  return new Response(JSON.stringify({ broadcast_id: broadcastId, sent, errors: errors.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}