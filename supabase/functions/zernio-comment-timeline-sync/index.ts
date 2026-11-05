// zernio-comment-timeline-sync — lê os registros (logs) das automações de comentário da Zernio
// e grava cada comentário de IG Flow na linha do tempo do lead (lead_activity_log).
// Idempotente: dedupe_hash = zernio_comment:{logId}. Comentários sem lead identificado
// são reprocessados nas próximas execuções (os logs continuam na Zernio).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const ZERNIO_BASE = 'https://zernio.com/api/v1/comment-automations';
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('ZERNIO_API_KEY');
  if (!key) return json({ error: 'ZERNIO_API_KEY not configured' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: flows } = await supabase.from('social_flows')
    .select('id, name, form_name, produto_nome, zernio_automation_id')
    .not('zernio_automation_id', 'is', null);

  const ids = new Map<string, any>();
  for (const f of flows ?? []) if (!ids.has(f.zernio_automation_id)) ids.set(f.zernio_automation_id, f);

  const stats = { automations: ids.size, logs: 0, linked: 0, inserted: 0, unmatched: 0, errors: 0 };
  const leadCache = new Map<string, string | null>();

  async function findLead(commenterId: string, username: string): Promise<string | null> {
    const ck = `${commenterId}|${username}`;
    if (leadCache.has(ck)) return leadCache.get(ck)!;
    let leadId: string | null = null;
    if (commenterId) {
      const { data } = await supabase.from('social_contacts').select('lead_id').eq('ig_user_id', commenterId).maybeSingle();
      leadId = (data as any)?.lead_id ?? null;
    }
    if (!leadId && username) {
      const u = username.replace(/^@/, '');
      const { data } = await supabase.from('social_contacts').select('lead_id')
        .ilike('ig_username', u).not('lead_id', 'is', null).limit(1);
      leadId = (data as any)?.[0]?.lead_id ?? null;
      if (!leadId) {
        const { data: l } = await supabase.from('lia_attendances').select('id')
          .is('merged_into', null).in('instagram', [`@${u}`, u]).limit(2);
        if (l && l.length === 1) leadId = l[0].id; // só vincula quando inequívoco
      }
    }
    if (leadId) {
      // sempre a ficha canônica
      const { data: c } = await supabase.from('lia_attendances').select('id, merged_into').eq('id', leadId).maybeSingle();
      if ((c as any)?.merged_into) leadId = (c as any).merged_into;
    }
    leadCache.set(ck, leadId);
    return leadId;
  }

  for (const [autoId, flow] of ids) {
    let logs: any[] = [];
    try {
      const r = await fetch(`${ZERNIO_BASE}/${autoId}/logs`, {
        headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) { stats.errors++; continue; }
      const d = await r.json();
      logs = d?.logs ?? d?.data?.logs ?? [];
    } catch { stats.errors++; continue; }

    for (const log of logs) {
      if (!log?.id || !log?.commentText) continue;
      stats.logs++;
      const leadId = await findLead(String(log.commenterId ?? ''), String(log.commenterUsername ?? ''));
      if (!leadId) { stats.unmatched++; continue; }
      stats.linked++;
      const hash = `zernio_comment:${log.id}`;
      const { data: dup } = await supabase.from('lead_activity_log').select('id')
        .eq('lead_id', leadId).eq('dedupe_hash', hash).limit(1);
      if (dup && dup.length) continue;
      const { error } = await supabase.from('lead_activity_log').insert({
        lead_id: leadId,
        event_type: 'social_comment',
        event_timestamp: new Date(log.createdAt ?? Date.now()).toISOString(),
        source_channel: 'zernio_instagram',
        entity_type: 'social_flow',
        entity_id: flow.id,
        entity_name: flow.name,
        event_data: {
          platform: 'instagram',
          automation_id: autoId,
          comment_id: log.commentId ?? null,
          username: log.commenterUsername ?? null,
          commenter_name: log.commenterName ?? null,
          message: String(log.commentText).slice(0, 4000),
          flow_name: flow.name,
          produto: flow.produto_nome ?? null,
          form_name: flow.form_name ?? null,
          dm_status: log.status ?? null,
          comment_reply_status: log.commentReplyStatus ?? null,
        },
        dedupe_hash: hash,
      });
      if (error) stats.errors++; else stats.inserted++;
    }
  }
  console.log(JSON.stringify({ event: 'zernio.comment_timeline_sync', ...stats }));
  return json({ ok: true, ...stats });
});
