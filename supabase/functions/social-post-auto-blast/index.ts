// Auto-blast: dispara para grupos WA cada publicação nova de social_posts,
// UMA ÚNICA VEZ. Cada linha recebe um blast_seq (compartilhado entre linhas
// com mesma caption_fingerprint via trigger no banco). Só disparamos quando
// blast_seq > ponteiro `social_auto_blast_last_seq` em cron_state.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { postTargetStatus } from '../_shared/post-group-eligibility.ts';
import { generatePostSummary, pickPostMedia } from '../_shared/post-summary.ts';
import { buildGroupBlastText, findGroupLink, splitGroupBlastExclusions } from '../_shared/testimonial-post-filter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_POSTS_PER_RUN = 20;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

/** Resumo curto para WhatsApp (prompt compartilhado em _shared/post-summary.ts). */
async function buildSummary(caption: string, platform: string): Promise<string> {
  return (await generatePostSummary(caption, platform, LOVABLE_API_KEY, '[social-post-auto-blast]')).text;
}

/** Escolhe a primeira mídia utilizável do post: media_urls → media_url → thumbnail_url. */
const pickMedia = pickPostMedia;

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

  const { data: fetchedPosts, error: pErr } = await query;
  if (pErr) {
    console.error('[social-post-auto-blast] fetch posts', pErr);
    return Response.json({ ok: false, error: pErr.message }, { status: 500, headers: corsHeaders });
  }

  // Não vão para os grupos: (1) depoimentos do pipeline de depoimentos (saem em
  // grande quantidade) e (2) posts agendados com "Enviar para os grupos" desligado.
  // São marcados como tratados e nunca disparam.
  let testimonialSkipped = 0;
  let optOutSkipped = 0;
  let posts = (fetchedPosts ?? []) as any[];
  if (posts.length > 0) {
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const [tRes, oRes] = await Promise.all([
      sb.from('social_scheduled_posts')
        .select('caption, channels')
        .like('created_by', 'training-testimonial%')
        .gte('created_at', since)
        .limit(1000),
      sb.from('social_scheduled_posts')
        .select('caption, channels')
        .eq('group_blast_enabled', false)
        .gte('created_at', since)
        .limit(1000),
    ]);
    const fErr = tRes.error ?? oRes.error;
    if (fErr) {
      // Sem as listas não dá para saber o que deve ficar fora: não dispara nada nesta rodada.
      console.error('[social-post-auto-blast] fetch exclusions', fErr);
      return Response.json({ ok: false, error: fErr.message }, { status: 500, headers: corsHeaders });
    }
    const { testimonialIds, optOutIds } = splitGroupBlastExclusions(
      posts, (tRes.data ?? []) as any[], (oRes.data ?? []) as any[],
    );
    const skipIds = [...testimonialIds, ...optOutIds];
    if (skipIds.length > 0) {
      await sb.from('social_posts').update({ auto_blast_at: new Date().toISOString() }).in('id', skipIds);
      testimonialSkipped = testimonialIds.length;
      optOutSkipped = optOutIds.length;
      console.log('[social-post-auto-blast] ignorados', JSON.stringify({ testimonials: testimonialIds, group_blast_disabled: optOutIds }));
      const skip = new Set(skipIds);
      posts = posts.filter((p) => !skip.has(p.id));
    }
  }
  if (!posts || posts.length === 0) {
    return Response.json({ ok: true, processed: 0, dispatched_campaigns: 0, skipped: 0, testimonial_skipped: testimonialSkipped, group_blast_disabled_skipped: optOutSkipped, last_seq: lastSeq }, { headers: corsHeaders });
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
    ? await sb.from('wa_groups').select('id, group_jid, instance_name, is_admin, enabled, ativo').in('id', targetIds)
    : { data: [] as any[] } as any;
  const groupById = new Map<string, any>((waGroups ?? []).map((g: any) => [g.id, g]));

  // jids por instância + plataformas permitidas (vazio = todas)
  type TargetJid = { jid: string; platforms: string[] };
  const targetsByInstance: Record<string, TargetJid[]> = {};
  // Segue a tela Post Grupos: instância ATIVA + grupo selecionado nela + redes.
  // O grupo precisa continuar vinculado ao mesmo número, ligado e com o número admin.
  const skippedTargets: Record<string, number> = {};
  for (const t of (targets ?? []) as any[]) {
    const g = groupById.get(t.group_id);
    const status = postTargetStatus(t.instance_name, g);
    if (status !== 'ready') { skippedTargets[status] = (skippedTargets[status] ?? 0) + 1; continue; }
    (targetsByInstance[t.instance_name] ??= []).push({
      jid: g.group_jid,
      platforms: Array.isArray(t.platforms) ? t.platforms : [],
    });
  }

  if (Object.keys(skippedTargets).length > 0) {
    console.log('[social-post-auto-blast] alvos fora do envio', JSON.stringify(skippedTargets));
  }

  // Link escolhido no agendamento ("Link para os grupos"), ligado ao post pela legenda.
  const { data: linkRows, error: linkErr } = await sb
    .from('social_scheduled_posts')
    .select('caption, channels, group_link_url, created_at')
    .not('group_link_url', 'is', null)
    .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  if (linkErr) console.error('[social-post-auto-blast] fetch group links', linkErr.message);

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
        const groupLink = findGroupLink(variant.caption, (linkRows ?? []) as any[]);
        const text = buildGroupBlastText(summary, link, groupLink);
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
    testimonial_skipped: testimonialSkipped,
    group_blast_disabled_skipped: optOutSkipped,
    dispatched_campaigns: dispatched,
    skipped,
    last_seq_before: lastSeq,
    last_seq_after: maxSeqDispatched,
  }, { headers: corsHeaders });
});