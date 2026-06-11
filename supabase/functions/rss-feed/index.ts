import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://parametros.smartdent.com.br';
const FEED_URL = `${BASE_URL}/rss.xml`;
const MAX_ITEMS = 50;

function escapeXml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(date: string | Date | null | undefined): string {
  const d = date ? new Date(date) : new Date();
  return d.toUTCString();
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data: items, error } = await supabase
      .from('knowledge_contents')
      .select('slug, title, excerpt, meta_description, content_html, updated_at, created_at, knowledge_categories!inner(letter, name)')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (error) throw error;

    const lastBuild = toRfc822(items?.[0]?.updated_at ?? new Date());

    const itemsXml = (items ?? []).map((row: any) => {
      const letter = (row.knowledge_categories?.letter || 'a').toLowerCase();
      const link = `${BASE_URL}/base-conhecimento/${letter}/${row.slug}`;
      const description = row.meta_description || row.excerpt || stripHtml(row.content_html) || row.title;
      const pubDate = toRfc822(row.created_at || row.updated_at);
      const category = row.knowledge_categories?.name || 'Conhecimento';
      return `    <item>
      <title>${escapeXml(row.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
      <description>${escapeXml(description)}</description>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Smart Dent | Fluxo Digital — Base de Conhecimento</title>
    <link>${BASE_URL}/base-conhecimento</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>Parâmetros 3D, guias clínicos e protocolos de odontologia digital atualizados pela Smart Dent.</description>
    <language>pt-BR</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${BASE_URL}/favicon-512x512.png</url>
      <title>Smart Dent | Fluxo Digital</title>
      <link>${BASE_URL}</link>
    </image>
${itemsXml}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
      },
    });
  } catch (err) {
    console.error('rss-feed error:', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>${escapeXml((err as Error).message)}</description></channel></rss>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  }
});