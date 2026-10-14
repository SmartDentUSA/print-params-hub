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
        id, title, description, video_type, url, embed_url, hls_url, thumbnail_url,
        video_duration_seconds, created_at,
        knowledge_contents!inner(
          id, slug, title, active,
          knowledge_categories!inner(letter, enabled)
        )
      `)
      .not('content_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }

    const activeVideos = (videos || []).filter((v: any) => {
      const content = v.knowledge_contents;
      return content?.active && content?.knowledge_categories?.enabled !== false
        && Boolean(v.embed_url || v.url)
        && Boolean(v.thumbnail_url); // Only publish complete, publicly playable video entries
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    const videosByPage = new Map<string, any[]>();
    for (const video of activeVideos) {
      const content = video.knowledge_contents;
      const letter = content.knowledge_categories?.letter?.toLowerCase() || 'a';
      const pageUrl = `${baseUrl}/base-conhecimento/${letter}/${content.slug}`;
      const pageVideos = videosByPage.get(pageUrl) || [];
      pageVideos.push(video);
      videosByPage.set(pageUrl, pageVideos);
    }

    for (const [pageUrl, pageVideos] of videosByPage) {
      xml += `  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n`;
      for (const v of pageVideos) {
        const content = v.knowledge_contents;
        const title = escapeXml(v.title || content.title || 'Vídeo');
        const description = escapeXml(
          (v.description || content.title || 'Vídeo tutorial SmartDent').substring(0, 2048)
        );
        const thumbnailUrl = escapeXml(v.thumbnail_url);
        // content_loc must point at the video bytes/stream, never at the player page.
        const contentUrl = v.hls_url ? escapeXml(v.hls_url) : '';
        const rawEmbedUrl = v.embed_url || (v.video_type === 'pandavideo' ? v.url : '');
        const embedUrl = rawEmbedUrl ? escapeXml(rawEmbedUrl) : '';
        const publicationDate = v.created_at && Number.isFinite(new Date(v.created_at).getTime())
          ? new Date(v.created_at).toISOString().split('T')[0]
          : '';

        xml += `    <video:video>
      <video:thumbnail_loc>${thumbnailUrl}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
${contentUrl ? `      <video:content_loc>${contentUrl}</video:content_loc>\n` : ''}${embedUrl ? `      <video:player_loc>${embedUrl}</video:player_loc>\n` : ''}${v.video_duration_seconds && v.video_duration_seconds > 0 ? `      <video:duration>${Math.floor(v.video_duration_seconds)}</video:duration>\n` : ''}${publicationDate ? `      <video:publication_date>${publicationDate}</video:publication_date>\n` : ''}      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
`;
      }
      xml += `  </url>\n`;
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

