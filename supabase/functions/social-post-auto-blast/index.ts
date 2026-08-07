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
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

/** Resumo curto para WhatsApp. Fallback: caption truncada. */
async function buildSummary(caption: string, platform: string): Promise<string> {
  const clean = String(caption ?? '').trim();
  const fallback = clean.length > 320 ? clean.slice(0, 317).trimEnd() + '…' : clean;
  if (!LOVABLE_API_KEY || !clean) return fallback;
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você resume posts da Smart Dent para grupos de WhatsApp de dentistas e laboratórios. Responda em português, 2 a 3 linhas, tom direto e convidativo, sem preços, sem hashtags, sem emojis em excesso (no máximo 2). Termine convidando a ver o post.' },
          { role: 'user', content: `Rede: ${platform}\n\nPost:\n${clean.slice(0, 1500)}` },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('[social-post-auto-blast] summary fail', res.status, await res.text());
      return fallback;
    }
    const j = await res.json();
    const txt = String(j?.choices?.[0]?.message?.content ?? '').trim();
    return txt || fallback;
  } catch (e) {
    console.warn('[social-post-auto-blast] summary error', e);
    return fallback;
  }
}

/** Escolhe a primeira mídia utilizável do post. */
function pickMedia(v: any): { url: string; kind: 'image' | 'video' } | null {
  const candidates: any[] = [];
  if (Array.isArray(v?.media_urls)) candidates.push(...v.media_urls);
  if (v?.media_url) candidates.push({ url: v.media_url, type: v.media_type });
  for (const c of candidates) {
    let url = typeof c === 'string' ? c : (c?.url ?? c?.public_url ?? null);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    // Miniaturas do YouTube vêm em 120px — sobe para hqdefault.
    url = String(url).replace('i.ytimg.com', 'i.ytimg.com').replace(/\/default\.jpg/, '/hqdefault.jpg');
    const t = String((typeof c === 'object' && c?.type) || v?.media_type || '').toLowerCase();
    const ext = (String(url).split('?')[0].split('.').pop() || '').toLowerCase();
    // A extensão manda: muitos posts (ex.: YouTube) marcam type=video mas a URL
    // disponível é a thumbnail .jpg — enviar como vídeo quebraria no WhatsApp.
    const imageExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const videoExt = ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
    const isVideo = videoExt || (!imageExt && t.includes('video'));
    return { url, kind: isVideo ? 'video' : 'image' };
  }
  return null;
}

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

  const selectCols = 'id, platform, caption, post_url, short_link, product_name, created_at, blast_seq, caption_fingerprint, media_url, media_urls, media_type, thumbnail_url';
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
  const variantsByRep = new Map<string, any[]>();
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
    variantsByRep.set(rep.id, sorted);
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
    .select('instance_name, group_id, enabled, platforms')
    .in('instance_name', instanceNames)
    .eq('enabled', true);
  const targetIds = Array.from(new Set((targets ?? []).map((t: any) => t.group_id).filter(Boolean)));

  const { data: waGroups } = targetIds.length
    ? await sb.from('wa_groups').select('id, group_jid, instance_name, is_admin, enabled').in('id', targetIds)
    : { data: [] as any[] } as any;
  const groupById = new Map<string, any>((waGroups ?? []).map((g: any) => [g.id, g]));

  // jids por instância + plataformas permitidas (vazio = todas)
  type TargetJid = { jid: string; platforms: string[] };
  const targetsByInstance: Record<string, TargetJid[]> = {};
  for (const t of (targets ?? []) as any[]) {
    const g = groupById.get(t.group_id);
    if (!g || !g.group_jid || !g.is_admin || !g.enabled) continue;
    (targetsByInstance[t.instance_name] ??= []).push({
      jid: g.group_jid,
      platforms: Array.isArray(t.platforms) ? t.platforms : [],
    });
  }

  let dispatched = 0;
  let skipped = 0;
  let deduped_suppressed = 0;
  let maxSeqDispatched = lastSeq;

  for (const post of capped) {
    const variants = (variantsByRep.get(post.id) ?? [post]).filter(
      (v: any) => (v.short_link || v.post_url) && String(v.caption ?? '').trim(),
    );
    if (variants.length === 0) { skipped++; continue; }

    let anyDispatched = false;
    for (const instance of instanceNames) {
      const list = targetsByInstance[instance] ?? [];
      if (list.length === 0) continue;

      // Cada grupo recebe apenas UMA mensagem: a da primeira rede permitida.
      const jidsByVariant = new Map<string, string[]>();
      for (const t of list) {
        const allowed = t.platforms.length === 0
          ? variants
          : variants.filter((v: any) => t.platforms.includes(v.platform));
        const chosen = allowed[0];
        if (!chosen) continue;
        (jidsByVariant.get(chosen.id) ?? jidsByVariant.set(chosen.id, []).get(chosen.id)!).push(t.jid);
      }

      for (const [variantId, jids] of jidsByVariant) {
        const variant = variants.find((v: any) => v.id === variantId)!;
        const link = variant.short_link || variant.post_url;
        const summary = await buildSummary(String(variant.caption ?? ''), String(variant.platform ?? 'post'));
        const text = `${summary}\n\n${link}`;
        const media = pickMedia(variant);
        const messageType = media ? media.kind : 'msg';
        const content = media
          ? { media_url: media.url, caption: text }
          : { text };
        try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-group-blast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            group_jids: jids,
            message_type: messageType,
            content,
            platform: variant.platform ?? undefined,
            campaign_name: `Auto #${post.blast_seq ?? '-'} | ${variant.platform ?? 'post'} | ${String(variant.id).slice(0, 8)}`,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json?.ok) { dispatched++; anyDispatched = true; }
        else console.warn('[social-post-auto-blast] wa-group-blast', instance, resp.status, json?.error ?? json?.message);
        } catch (e) {
          console.error('[social-post-auto-blast] blast call failed', instance, e);
        }
      }
    }

    const siblings = suppressedIdsByRep.get(post.id) ?? [];
    deduped_suppressed += siblings.length;
    const idsToMark = [post.id, ...siblings];
    // Se nenhum grupo aceitou o post (ex.: filtro de plataforma do grupo), não
    // consumimos o post: ele volta na próxima rodada por até 24h, para que ajustar
    // a configuração de grupos/plataformas ainda permita o disparo.
    const ageMs = Date.now() - new Date(post.created_at ?? 0).getTime();
    const keepForRetry = !anyDispatched && ageMs < 24 * 60 * 60 * 1000;
    if (!keepForRetry) {
      await sb.from('social_posts').update({ auto_blast_at: new Date().toISOString() }).in('id', idsToMark);
    }
    if (!anyDispatched) {
      skipped++;
      console.warn('[social-post-auto-blast] nenhum grupo elegível', JSON.stringify({
        post_id: post.id, platform: post.platform, blast_seq: post.blast_seq, keep_for_retry: keepForRetry,
      }));
    }
    const seqNum = Number(post.blast_seq ?? 0);
    if (!keepForRetry && seqNum > maxSeqDispatched) maxSeqDispatched = seqNum;
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