import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'PT5M0S';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `PT${h}H${m}M${s}S` : `PT${m}M${s}S`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const baseUrl = 'https://parametros.smartdent.com.br';

    // Fetch videos with their associated knowledge content and category
    const { data: videos, error } = await supabase
      .from('knowledge_videos')
      .select(`
        id, title, description, url, embed_url, thumbnail_url,
        video_duration_seconds, created_at,
        knowledge_contents!inner(
          id, slug, title, active,
          knowledge_categories!inner(letter, enabled)
        )
      `)
      .not('content_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }

    const activeVideos = (videos || []).filter((v: any) => {
      const content = v.knowledge_contents;
      return content?.active && content?.knowledge_categories?.enabled !== false;
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    for (const v of activeVideos) {
      const content = v.knowledge_contents;
      const letter = content.knowledge_categories?.letter?.toLowerCase() || 'a';
      const pageUrl = `${baseUrl}/base-conhecimento/${letter}/${content.slug}`;
      const title = escapeXml(v.title || content.title || 'Vídeo');
      const description = escapeXml(
        (v.description || content.title || 'Vídeo tutorial SmartDent').substring(0, 2048)
      );
      const thumbnailUrl = v.thumbnail_url
        ? escapeXml(v.thumbnail_url)
        : `${baseUrl}/placeholder.svg`;
      const contentUrl = v.url ? escapeXml(v.url) : '';
      const embedUrl = v.embed_url ? escapeXml(v.embed_url) : '';
      const uploadDate = v.created_at
        ? new Date(v.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const duration = formatDuration(v.video_duration_seconds);

      xml += `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${thumbnailUrl}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
${contentUrl ? `      <video:content_loc>${contentUrl}</video:content_loc>\n` : ''}${embedUrl ? `      <video:player_loc>${embedUrl}</video:player_loc>\n` : ''}      <video:duration>${v.video_duration_seconds || 300}</video:duration>
      <video:publication_date>${uploadDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>
`;
    }

    xml += `</urlset>`;

    console.log(`[video-sitemap] Generated sitemap with ${activeVideos.length} videos`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    console.error('[video-sitemap] Error:', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      },
      status: 500,
    });
  }
});
