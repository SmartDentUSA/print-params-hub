// sequence-runner — avança social_sequence_enrollments
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function template(str: string, ctx: Record<string, any>): string {
  return (str ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => String(ctx?.[k] ?? ''));
}

const KNOWLEDGE_URL = Deno.env.get('SYSTEM_A_KNOWLEDGE_URL')
  ?? 'https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full';
const productCache = new Map<string, { at: number; data: any }>();
async function getProduct(slug: string): Promise<any | null> {
  const c = productCache.get(slug);
  if (c && Date.now() - c.at < 5 * 60_000) return c.data;
  try {
    const r = await fetch(`${KNOWLEDGE_URL}?limit=500&include=products`, { method: 'GET' });
    const j = await r.json();
    const prod = (j?.products ?? []).find((p: any) => p?.slug === slug) ?? null;
    productCache.set(slug, { at: Date.now(), data: prod });
    return prod;
  } catch (e) { console.error('knowledge fetch fail', e); return null; }
}

async function renderStep(step: any): Promise<string> {
  const kind = step?.kind ?? 'msg';
  if (kind === 'link_ig' || kind === 'link_yt') {
    const cap = (step.caption ?? '').trim();
    return cap ? `${cap}\n\n${step.url}` : String(step.url ?? '');
  }
  if (kind === 'promo_seq') {
    const prod = await getProduct(step.produto_slug);
    const raw: any[] = prod?.messages?.[step.bucket] ?? [];
    const enabledOrders = new Set((step.messages ?? []).filter((m: any) => m.enabled !== false).map((m: any) => Number(m.order)));
    const msgs = raw
      .map((m, i) => ({ order: Number(m?.message_order ?? i + 1), content: String(m?.message_content ?? m?.content ?? '') }))
      .filter((m) => m.content.trim() && (enabledOrders.size === 0 || enabledOrders.has(m.order)))
      .sort((a, b) => a.order - b.order)
      .map((m) => m.content);
    return msgs.join('\n\n———\n\n');
  }
  return template(step?.message ?? '', {});
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: enrollments } = await supabase
    .from('social_sequence_enrollments')
    .select('*, social_sequences!inner(id, channel, steps, is_active)')
    .eq('status', 'active')
    .lte('next_step_at', new Date().toISOString())
    .limit(50);

  const { data: tm } = await supabase.from('team_members').select('evolution_instance_name, evolution_api_key').eq('ativo', true).not('evolution_api_key', 'is', null).limit(1).single();
  let processed = 0;

  for (const e of enrollments ?? []) {
    try {
      const seq: any = (e as any).social_sequences;
      if (!seq.is_active) {
        await supabase.from('social_sequence_enrollments').update({ status: 'paused' }).eq('id', e.id);
        continue;
      }
      const steps: any[] = seq.steps ?? [];
      const idx = e.current_step ?? 0;
      if (idx >= steps.length) {
        await supabase.from('social_sequence_enrollments').update({ status: 'completed' }).eq('id', e.id);
        continue;
      }
      const step = steps[idx];
      const text = await renderStep(step);

      if (seq.channel === 'whatsapp' && tm) {
        // Para WA precisamos do phone do lead — buscar via ig_user_id (workaround) ou lead_id
        // Aqui assumimos que ig_user_id armazena o phone para canal whatsapp
        const phone = String(e.ig_user_id).replace(/\D/g, '');
        if (phone) {
          await fetch(`https://evolution.smartdent.com.br/message/sendText/${tm.evolution_instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: tm.evolution_api_key },
            body: JSON.stringify({ number: phone, text }),
          }).catch((err) => console.error('seq wa fail', err));
        }
      }

      const next = idx + 1;
      const nextStep = steps[next];
      const nextAt = nextStep ? new Date(Date.now() + (nextStep.delay_minutes ?? 0) * 60_000).toISOString() : null;
      await supabase.from('social_sequence_enrollments').update({
        current_step: next,
        next_step_at: nextAt,
        status: nextStep ? 'active' : 'completed',
      }).eq('id', e.id);
      processed++;
    } catch (err: any) {
      console.error(JSON.stringify({ event: 'seq.fail', id: e.id, error: String(err?.message ?? err) }));
    }
  }

  return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});