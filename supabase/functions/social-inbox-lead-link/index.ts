// social-inbox-lead-link — identifica leads das conversas do Zernio e grava na timeline
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g;

function digits(v: string) { return (v ?? '').replace(/\D/g, ''); }

function normalizePhone(raw: string): string | null {
  let d = digits(raw);
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

function extract(text: string) {
  const emails = Array.from(new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase())));
  const phones = Array.from(new Set((text.match(PHONE_RE) ?? []).map(normalizePhone).filter(Boolean) as string[]));
  return { emails, phones };
}

type Lead = { id: string; nome: string | null; email: string | null; telefone_normalized: string | null; instagram: string | null };
const LEAD_COLS = 'id, nome, email, telefone_normalized, instagram';

/** Cliente = tem ao menos 1 deal GANHO. Sem deal ganho = apenas lead. */
async function classifyLead(supabase: any, leadId: string): Promise<{
  is_customer: boolean; won_deals: number; ltv_total: number;
}> {
  const { count } = await supabase.from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId).eq('status', 'ganha');
  let won = Number(count ?? 0);

  const { data: lead } = await supabase.from('lia_attendances')
    .select('ltv_total, status_oportunidade, piperun_deals_history')
    .eq('id', leadId).maybeSingle();

  if (won === 0) {
    const hist = Array.isArray(lead?.piperun_deals_history) ? lead!.piperun_deals_history : [];
    won = hist.filter((d: any) => /ganh/i.test(String(d?.status ?? d?.deal_status ?? '')) || String(d?.status) === '2').length;
    if (won === 0 && /ganh/i.test(String(lead?.status_oportunidade ?? ''))) won = 1;
  }
  return { is_customer: won > 0, won_deals: won, ltv_total: Number(lead?.ltv_total ?? 0) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = String(body.action ?? 'resolve');

  const findLead = async (opts: {
    name?: string | null; username?: string | null; text?: string | null;
  }): Promise<{ lead: Lead | null; matched_by: string | null }> => {
    const { emails, phones } = extract(String(opts.text ?? ''));
    const username = String(opts.username ?? '').replace(/^@/, '').trim();
    const name = String(opts.name ?? '').trim();

    // 1. e-mail (mais forte)
    for (const email of emails) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).ilike('email', email).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'email' };
    }
    // 2. telefone
    for (const phone of phones) {
      const variants = [`+55${phone}`, `55${phone}`, phone];
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).in('telefone_normalized', variants).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'telefone' };
    }
    // 3. @instagram salvo no lead
    if (username) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).or(`instagram.ilike.%${username}%,instagram.ilike.%@${username}%`).limit(1);
      if (data?.length) return { lead: data[0] as Lead, matched_by: 'instagram' };
    }
    // 4. nome exato (último recurso)
    if (name.length >= 6 && name.includes(' ')) {
      const { data } = await supabase.from('lia_attendances').select(LEAD_COLS)
        .is('merged_into', null).ilike('nome', name).limit(2);
      if (data?.length === 1) return { lead: data[0] as Lead, matched_by: 'nome' };
    }
    return { lead: null, matched_by: null };
  };

  try {
    if (action === 'resolve') {
      const items: any[] = Array.isArray(body.conversations) ? body.conversations : [];
      const results: any[] = [];
      for (const c of items.slice(0, 100)) {
        const { lead, matched_by } = await findLead({
          name: c.participantName, username: c.participantUsername,
          text: [c.lastMessage, c.text].filter(Boolean).join('\n'),
        });
        const cls = lead ? await classifyLead(supabase, lead.id) : null;
        results.push({
          conversationId: c.id,
          matched_by,
          lead: lead ? { id: lead.id, nome: lead.nome, email: lead.email, telefone: lead.telefone_normalized } : null,
          is_customer: cls?.is_customer ?? false,
          won_deals: cls?.won_deals ?? 0,
          ltv_total: cls?.ltv_total ?? 0,
        });
      }
      return json({ results });
    }

    if (action === 'log_timeline') {
      const conversationId = String(body.conversationId ?? '');
      const platform = String(body.platform ?? 'instagram');
      const messages: any[] = Array.isArray(body.messages) ? body.messages : [];
      if (!conversationId || messages.length === 0) return json({ error: 'conversationId e messages obrigatórios' }, 400);

      let leadId: string | null = body.leadId ? String(body.leadId) : null;
      let matchedBy: string | null = leadId ? 'manual' : null;
      if (!leadId) {
        const allText = messages.map((m) => m.text ?? m.message ?? '').join('\n');
        const r = await findLead({
          name: body.participantName, username: body.participantUsername,
          text: [body.lastMessage, allText].filter(Boolean).join('\n'),
        });
        leadId = r.lead?.id ?? null;
        matchedBy = r.matched_by;
      }
      if (!leadId) return json({ linked: false, reason: 'lead_not_found' });

      const rows = messages
        .map((m) => {
          const text = String(m.text ?? m.message ?? '').trim();
          if (!text) return null;
          const out = m.direction === 'outgoing';
          const ts = m.sentAt ?? m.createdAt ?? new Date().toISOString();
          return {
            lead_id: leadId,
            event_type: out ? 'social_dm_sent' : 'social_dm_received',
            event_timestamp: new Date(ts).toISOString(),
            source_channel: `zernio_${platform}`,
            entity_type: 'social_conversation',
            entity_id: String(m.id ?? `${conversationId}:${ts}`),
            entity_name: body.participantName ?? body.participantUsername ?? 'Conversa social',
            event_data: {
              platform,
              conversation_id: conversationId,
              direction: out ? 'outgoing' : 'incoming',
              sender: out ? 'Smart Dent' : (m.senderName ?? body.participantName ?? null),
              username: body.participantUsername ?? null,
              message: text.slice(0, 4000),
              matched_by: matchedBy,
            },
            dedupe_hash: `zernio_dm:${String(m.id ?? `${conversationId}:${ts}`)}`,
          };
        })
        .filter(Boolean);

      if (rows.length === 0) return json({ linked: true, lead_id: leadId, inserted: 0 });

      const { error, data } = await supabase.from('lead_activity_log')
        .upsert(rows as any[], { onConflict: 'lead_id,event_type,dedupe_hash', ignoreDuplicates: true })
        .select('id');
      if (error) return json({ error: error.message }, 500);

      return json({ linked: true, lead_id: leadId, matched_by: matchedBy, inserted: data?.length ?? 0 });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error('[social-inbox-lead-link] fail', e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
