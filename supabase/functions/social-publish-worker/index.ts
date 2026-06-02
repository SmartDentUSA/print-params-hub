// social-publish-worker — consome social_scheduled_posts e publica via Zernio
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';
const BATCH_SIZE = 10;

// Mapeia canais internos para plataforma Zernio
function toZernioPlatform(channel: string): string | null {
  if (!channel) return null;
  const c = channel.toLowerCase();
  if (c.startsWith('instagram')) return 'instagram';
  if (c.startsWith('facebook')) return 'facebook';
  if (c.startsWith('tiktok')) return 'tiktok';
  if (c.startsWith('youtube')) return 'youtube';
  if (c.startsWith('linkedin')) return 'linkedin';
  if (c.startsWith('threads')) return 'threads';
  if (c.startsWith('pinterest')) return 'pinterest';
  if (c.startsWith('twitter') || c === 'x') return 'twitter';
  if (c.startsWith('bluesky')) return 'bluesky';
  if (c.startsWith('reddit')) return 'reddit';
  return c;
}

function inferMediaType(url: string): 'image' | 'video' {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  return ['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext) ? 'video' : 'image';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const apiKey = Deno.env.get('ZERNIO_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ZERNIO_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 1. Buscar candidatos (publish_now=true OR scheduled<=now), claim atômico
  const nowIso = new Date().toISOString();
  const { data: candidates, error: selErr } = await supabase
    .from('social_scheduled_posts')
    .select('id, status, publish_now, scheduled_at')
    .or(`and(status.eq.scheduled,scheduled_at.lte.${nowIso}),and(status.eq.publishing,publish_now.eq.true)`)
    .order('scheduled_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (selErr) {
    console.error('[worker] select error', selErr);
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Claim — vira status 'publishing' nos que ainda estão 'scheduled'
  const ids = candidates.map((c) => c.id);
  const { data: claimed, error: claimErr } = await supabase
    .from('social_scheduled_posts')
    .update({ status: 'publishing', updated_at: nowIso })
    .in('id', ids)
    .in('status', ['scheduled', 'publishing'])
    .select('*');

  if (claimErr) {
    console.error('[worker] claim error', claimErr);
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Carrega contas Zernio uma vez
  const { data: accountsList } = await supabase
    .from('social_zernio_accounts')
    .select('zernio_account_id, platform, active')
    .eq('active', true);

  const accountsByPlatform = new Map<string, string>();
  for (const a of accountsList || []) {
    if (!accountsByPlatform.has(a.platform)) {
      accountsByPlatform.set(a.platform, a.zernio_account_id);
    }
  }

  const results: any[] = [];

  for (const post of claimed || []) {
    try {
      const channels: any[] = Array.isArray(post.channels) ? post.channels : [];
      const mediaItems: any[] = Array.isArray(post.media_items) ? post.media_items : [];
      const perChannelMedia: Record<string, any[]> =
        post.per_channel_media && typeof post.per_channel_media === 'object'
          ? post.per_channel_media
          : {};

      const platforms: any[] = [];
      const skipped: any[] = [];
      for (const ch of channels) {
        const platform = toZernioPlatform(ch.platform ?? ch.channel ?? ch.type ?? ch);
        if (!platform) continue;
        const accountId = ch.accountId ?? ch.account_id ?? accountsByPlatform.get(platform);
        if (!accountId) {
          skipped.push({ channel: ch, reason: 'no_zernio_account' });
          continue;
        }
        platforms.push({ platform, accountId });
      }

      if (platforms.length === 0) {
        throw new Error(`Nenhum canal mapeado com conta Zernio. Skipped: ${JSON.stringify(skipped)}`);
      }

      const content = [
        post.caption ?? '',
        Array.isArray(post.hashtags) && post.hashtags.length > 0
          ? post.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
          : '',
      ].filter(Boolean).join('\n\n');

      const mapMedia = (items: any[]) =>
        items
          .map((m) => {
            const url = m.url ?? m.public_url ?? m.publicUrl;
            if (!url) return null;
            return { url, type: m.type ?? inferMediaType(url) };
          })
          .filter(Boolean);
      const defaultMedia = mapMedia(mediaItems);

      // Agrupa: plataformas SEM override entram em 1 chamada bulk; cada override = chamada própria
      const groups: Array<{ platforms: any[]; media: any[]; label: string }> = [];
      const bulkPlatforms: any[] = [];
      for (const p of platforms) {
        const override = perChannelMedia[p.platform];
        if (Array.isArray(override) && override.length > 0) {
          groups.push({ platforms: [p], media: mapMedia(override), label: p.platform });
        } else {
          bulkPlatforms.push(p);
        }
      }
      if (bulkPlatforms.length > 0) {
        groups.unshift({ platforms: bulkPlatforms, media: defaultMedia, label: 'default' });
      }

      const idsMap: Record<string, string> = {};
      const groupErrors: any[] = [];

      for (const g of groups) {
        const payload: any = {
          content,
          publishNow: true,
          timezone: post.timezone ?? 'America/Sao_Paulo',
          platforms: g.platforms,
        };
        if (g.media.length > 0) payload.mediaItems = g.media;
        if (post.first_comment) payload.firstComment = post.first_comment;

        const res = await fetch(`${ZERNIO_BASE}/posts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          groupErrors.push({ group: g.label, status: res.status, response: data });
          continue;
        }
        const zernioId = data?.post?._id ?? data?.post?.id ?? data?._id ?? null;
        for (const p of g.platforms) idsMap[p.platform] = zernioId;
      }

      if (Object.keys(idsMap).length === 0) {
        throw new Error(`Zernio falhou em todos os grupos: ${JSON.stringify(groupErrors)}`);
      }

      await supabase
        .from('social_scheduled_posts')
        .update({
          status: groupErrors.length > 0 ? 'partial' : 'published',
          published_at: new Date().toISOString(),
          zernio_post_ids: idsMap,
          publish_errors: [...skipped, ...groupErrors].length > 0 ? [...skipped, ...groupErrors] : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      console.log(JSON.stringify({ event: 'publish.ok', post_id: post.id, platforms: Object.keys(idsMap), errors: groupErrors.length }));
      results.push({ id: post.id, status: 'published', errors: groupErrors.length });
    } catch (err: any) {
      console.error(JSON.stringify({ event: 'publish.fail', post_id: post.id, error: String(err?.message ?? err) }));
      await supabase
        .from('social_scheduled_posts')
        .update({
          status: 'failed',
          publish_errors: [{ at: new Date().toISOString(), message: String(err?.message ?? err) }],
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      results.push({ id: post.id, status: 'failed', error: String(err?.message ?? err) });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});