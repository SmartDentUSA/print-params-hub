import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch all active knowledge content with categories
    const { data: contents, error } = await supabaseClient
      .from('knowledge_contents')
      .select(`
        slug,
        updated_at,
        category_id,
        knowledge_categories!inner(letter)
      `)
      .eq('active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const baseUrl = 'https://parametros.smartdent.com.br';
    
    // Generate sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <!-- Knowledge Base Homepage - Spanish -->
  <url>
    <loc>${baseUrl}/es/base-conocimiento</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${baseUrl}/base-conhecimento"/>
    <xhtml:link rel="alternate" hreflang="en-US" href="${baseUrl}/en/knowledge-base"/>
    <xhtml:link rel="alternate" hreflang="es-ES" href="${baseUrl}/es/base-conocimiento"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/base-conhecimento"/>
  </url>
${contents.map(content => {
  const categoryLetter = content.knowledge_categories?.letter?.toLowerCase() || 'a';
  const lastmod = new Date(content.updated_at).toISOString();
  
  return `  <url>
    <loc>${baseUrl}/es/base-conocimiento/${categoryLetter}/${content.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${baseUrl}/base-conhecimento/${categoryLetter}/${content.slug}"/>
    <xhtml:link rel="alternate" hreflang="en-US" href="${baseUrl}/en/knowledge-base/${categoryLetter}/${content.slug}"/>
    <xhtml:link rel="alternate" hreflang="es-ES" href="${baseUrl}/es/base-conocimiento/${categoryLetter}/${content.slug}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/base-conhecimento/${categoryLetter}/${content.slug}"/>
  </url>`;
}).join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
