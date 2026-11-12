// wa-post-teaser: prepara o envio de uma publicação para grupos de WhatsApp.
// Gera um resumo isca curto (IA, sem preços) e copia a capa da publicação para
// o storage `wa-media` (as URLs da CDN do Instagram expiram). Apenas equipe interna.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateResponse, GatewayError } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import { buildTeaserMessage, cleanCaption, fallbackTeaser, pickCoverUrl } from './teaser.ts';
import { generatePostSummary } from '../_shared/post-summary.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = [
  'Você escreve chamadas curtas para divulgar publicações da Smart Dent em grupos de WhatsApp de dentistas e laboratórios.',
  'Escreva um RESUMO ISCA em português do Brasil: no máximo 3 linhas curtas (até 260 caracteres no total).',
  'Desperte curiosidade sobre o benefício principal sem entregar todo o conteúdo, para a pessoa querer abrir a publicação.',
  'Pode usar *negrito* do WhatsApp em uma expressão e no máximo 2 emojis.',
  'Proibido: preços, valores, descontos, hashtags, menções, links e informações que não estejam na legenda.',
  'Termine com uma chamada curta para ver a publicação completa. Responda só com o texto.',
].join(' ');

async function makeTeaser(caption: string, platform: string): Promise<{ text: string; ai: boolean }> {
  const clean = cleanCaption(caption);
  if (!clean) return { text: fallbackTeaser(''), ai: false };
  try {
    const r: any = await generateResponse({
      model: 'openai/gpt-6-astra',
      instructions: SYSTEM,
      input: `Rede: ${platform || 'post'}\n\nLegenda da publicação:\n${clean.slice(0, 2000)}`,
    });
    const txt = (r?.output ?? [])
      .flatMap((o: any) => (o?.type === 'message' ? o.content ?? [] : []))
      .filter((c: any) => c?.type === 'output_text')
      .map((c: any) => String(c.text ?? ''))
      .join('')
      .trim();
    if (txt && txt.length <= 600 && !/R\$\s?\d/.test(txt)) return { text: txt, ai: true };
  } catch (e) {
    console.warn('[wa-post-teaser] IA falhou', e instanceof GatewayError ? `${e.code} ${e.httpStatus}` : String(e));
  }
  return { text: fallbackTeaser(clean), ai: false };
}

async function copyCover(sb: any, src: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(src, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartDentBot/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.warn('[wa-post-teaser] capa', res.status); return null; }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!type.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return null;
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const path = `post-cover/${key}.${ext}`;
    const { error } = await sb.storage.from('wa-media').upload(path, buf, { contentType: type, upsert: true, cacheControl: '86400' });
    if (error) { console.warn('[wa-post-teaser] upload', error.message); return null; }
    return sb.storage.from('wa-media').getPublicUrl(path).data.publicUrl as string;
  } catch (e) {
    console.warn('[wa-post-teaser] capa erro', String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const { data: isStaff } = await userClient.rpc('fn_is_internal_staff' as any, { _user_id: u.user.id });
    if (!isStaff) return json({ error: 'Sem permissão' }, 403);

    const body = await req.json().catch(() => ({}));
    const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let caption = String(body?.caption ?? '');
    let link = String(body?.url ?? '');
    let platform = String(body?.platform ?? '');
    let cover = pickCoverUrl({ thumbnail_url: body?.thumbnail_url ?? null });
    const postId = typeof body?.post_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.post_id) ? body.post_id : null;

    if (postId) {
      const { data: p } = await sb.from('social_posts')
        .select('id, caption, post_url, short_link, platform, thumbnail_url, media_url, media_urls')
        .eq('id', postId).maybeSingle();
      if (p) {
        caption = caption || p.caption || '';
        link = p.short_link || p.post_url || link;
        platform = p.platform || platform;
        cover = pickCoverUrl(p) ?? cover;
      }
    }
    if (!link) return json({ error: 'Publicação sem link' }, 400);

    const key = postId ?? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(link))))
      .slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');

    // style "resumo": resumo do editor de campanha (nós post_*/link_*), com o
    // mesmo prompt do envio automático de Post Grupos. Padrão: resumo isca do envio manual.
    const style = body?.style === 'resumo' ? 'resumo' : 'teaser';
    const [teaser, mediaUrl] = await Promise.all([
      style === 'resumo'
        ? generatePostSummary(caption, platform || 'post', Deno.env.get('LOVABLE_API_KEY'), '[wa-post-teaser]')
        : makeTeaser(caption, platform),
      cover ? copyCover(sb, cover, key) : Promise.resolve(null),
    ]);

    return json({
      ok: true,
      teaser: teaser.text,
      ai: teaser.ai,
      link,
      message: buildTeaserMessage(teaser.text, link),
      media_url: mediaUrl,
    });
  } catch (e) {
    console.error('[wa-post-teaser]', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
