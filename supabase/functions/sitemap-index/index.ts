const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://www.smartdent.com.br';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { ...corsHeaders, Allow: 'GET, HEAD' } });
  }

  const now = new Date().toISOString().slice(0, 10);
  const children = [
    'sitemap.xml',
    'sitemap-conhecimento-pt.xml',
    'sitemap-conhecimento-en.xml',
    'sitemap-conhecimento-es.xml',
    'sitemap-documentos.xml',
    'video-sitemap.xml',
  ];
  const entries = children.map((name) => `  <sitemap><loc>${BASE}/${name}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
  return new Response(req.method === 'HEAD' ? null : xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    },
  });
});

