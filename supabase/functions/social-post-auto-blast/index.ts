// Auto-blast: dispara para grupos WA cada publicação nova de social_posts,
// UMA ÚNICA VEZ. Cada linha recebe um blast_seq (compartilhado entre linhas
// com mesma caption_fingerprint via trigger no banco). Só disparamos quando
// blast_seq > ponteiro `social_auto_blast_last_seq` em cron_state.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_POSTS_PER_RUN = 20;

interface Body {
  post_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let body: Body = {};
  try { body = req.method === 'POST' ? await req.json() : {}; } catch { body = {}; }

  // Ponteiro do último seq disparado
  const { data: ptrRow } = await sb
    .from('cron_state')
    .select('value')
    .eq('key', 'social_auto_blast_last_seq')
    .maybeSingle();
  const lastSeq = Number(ptrRow?.value ?? 0) || 0;

  const selectCols = 'id, platform, caption, post_url, short_link, product_name, created_at, blast_seq, caption_fingerprint';
  let query = sb
    .from('social_posts')
    .select(selectCols)
    .is('auto_blast_at', null)
    .not('caption', 'is', null)
    .gt('blast_seq', lastSeq)
    .order('blast_seq', { ascending: true })
    .limit(MAX_POSTS_PER_RUN * 4);
  if (body.post_id) query = sb.from('social_posts')
    .select(selectCols)
    .eq('id', body.post_id)
    .is('auto_blast_at', null)
    .not('caption', 'is', null);

  const { data: posts, error: pErr } = await query;
  if (pErr) {
    console.error('[social-post-auto-blast] fetch posts', pErr);
    return Response.json({ ok: false, error: pErr.message }, { status: 500, headers: corsHeaders });
  }
  if (!posts || posts.length === 0) {
    return Response.json({ ok: true, processed: 0, dispatched_campaigns: 0, skipped: 0, last_seq: lastSeq }, { headers: corsHeaders });
  }

  // Agrupa por blast_seq (linhas com mesma seq = mesma legenda).
  const PLATFORM_PRIORITY: Record<string, number> = {
    instagram: 0, facebook: 1, tiktok: 2, youtube: 3,
  };
  const groups = new Map<string, any[]>();
  for (const p of posts as any[]) {
    const key = p.blast_seq != null ? `seq:${p.blast_seq}` : `fp:${p.caption_fingerprint ?? p.id}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
  }
  const representatives: any[] = [];
  const suppressedIdsByRep = new Map<string, string[]>();
  for (const [key, arr] of groups) {
    const sorted = [...arr].sort((a, b) => {
      const pa = PLATFORM_PRIORITY[a.platform] ?? 99;
      const pb = PLATFORM_PRIORITY[b.platform] ?? 99;
      if (pa !== pb) return pa - pb;
      const ua = (a.short_link || a.post_url) ? 0 : 1;
      const ub = (b.short_link || b.post_url) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });
    let rep = sorted[0];
    if (!(rep.short_link || rep.post_url)) {
      const withUrl = sorted.find((r) => r.short_link || r.post_url);
      if (withUrl) rep = withUrl;
    }
    const siblings = arr.filter((r) => r.id !== rep.id).map((r) => r.id);
    representatives.push(rep);
    suppressedIdsByRep.set(rep.id, siblings);
    if (siblings.length > 0) {
      console.log('[social-post-auto-blast] deduped by seq', JSON.stringify({
        key,
        chosen: rep.id,
        chosen_platform: rep.platform,
        suppressed_count: siblings.length,
        suppressed_platforms: arr.filter((r) => r.id !== rep.id).map((r) => r.platform),
      }));
    }
  }
  representatives.sort((a, b) => Number(a.blast_seq ?? 0) - Number(b.blast_seq ?? 0));
  const capped = representatives.slice(0, MAX_POSTS_PER_RUN);

  // 2. Fetch instâncias ativas e seus targets (1x)
  const { data: activeInstances } = await sb
    .from('post_group_instance_config')
    .select('instance_name')
    .eq('enabled', true);
  const instanceNames = (activeInstances ?? []).map((r: any) => r.instance_name);
  if (instanceNames.length === 0) {
    const ids = posts.map((p: any) => p.id);
    await sb.from('social_posts').update({ auto_blast_at: new Date().toISOString() }).in('id', ids);
    const maxSeq = Math.max(lastSeq, ...posts.map((p: any) => Number(p.blast_seq ?? 0)));
    await sb.from('cron_state').upsert({ key: 'social_auto_blast_last_seq', value: String(maxSeq), updated_at: new Date().toISOString() });
    return Response.json({ ok: true, processed: posts.length, dispatched_campaigns: 0, skipped: posts.length, reason: 'no_active_instances' }, { headers: corsHeaders });
  }

  // targets por instância
  const { data: targets } = await sb
    .from('post_group_targets')
    .select('instance_name, group_id, enabled')
    .in('instance_name', instanceNames)
    .eq('enabled', true);
  const targetIds = Array.from(new Set((targets ?? []).map((t: any) => t.group_id).filter(Boolean)));

  const { data: waGroups } = targetIds.length
    ? await sb.from('wa_groups').select('id, group_jid, instance_name, is_admin, enabled').in('id', targetIds)
    : { data: [] as any[] } as any;
  const groupById = new Map<string, any>((waGroups ?? []).map((g: any) => [g.id, g]));

  const jidsByInstance: Record<string, string[]> = {};
  for (const t of (targets ?? []) as any[]) {
    const g = groupById.get(t.group_id);
    if (!g || !g.group_jid || !g.is_admin || !g.enabled) continue;
    (jidsByInstance[t.instance_name] ??= []).push(g.group_jid);
  }

  let dispatched = 0;
  let skipped = 0;
  let deduped_suppressed = 0;
  let maxSeqDispatched = lastSeq;

  for (const post of capped) {
    const url = post.short_link || post.post_url;
    if (!url) { skipped++; continue; }
    const captionBody = (post.caption ?? '').trim();
    if (!captionBody) { skipped++; continue; }
    const text = `${captionBody}\n\n${url}`;

    let anyDispatched = false;
    for (const instance of instanceNames) {
      const jids = jidsByInstance[instance] ?? [];
      if (jids.length === 0) continue;
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-group-blast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            group_jids: jids,
            message_type: 'msg',
            content: { text },
            campaign_name: `Auto #${post.blast_seq ?? '-'} | ${post.platform ?? 'post'} | ${String(post.id).slice(0, 8)}`,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json?.ok) { dispatched++; anyDispatched = true; }
        else console.warn('[social-post-auto-blast] wa-group-blast', instance, resp.status, json?.error ?? json?.message);
      } catch (e) {
        console.error('[social-post-auto-blast] blast call failed', instance, e);
      }
    }

    const siblings = suppressedIdsByRep.get(post.id) ?? [];
    deduped_suppressed += siblings.length;
    const idsToMark = [post.id, ...siblings];
    await sb.from('social_posts').update({ auto_blast_at: new Date().toISOString() }).in('id', idsToMark);
    if (!anyDispatched) skipped++;
    const seqNum = Number(post.blast_seq ?? 0);
    if (seqNum > maxSeqDispatched) maxSeqDispatched = seqNum;
  }

  if (maxSeqDispatched > lastSeq) {
    await sb.from('cron_state').upsert({
      key: 'social_auto_blast_last_seq',
      value: String(maxSeqDispatched),
      updated_at: new Date().toISOString(),
    });
  }

  return Response.json({
    ok: true,
    processed: posts.length,
    deduped_representatives: capped.length,
    deduped_suppressed,
    dispatched_campaigns: dispatched,
    skipped,
    last_seq_before: lastSeq,
    last_seq_after: maxSeqDispatched,
  }, { headers: corsHeaders });
});