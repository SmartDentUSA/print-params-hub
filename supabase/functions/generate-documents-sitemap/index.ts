import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching technical documents for sitemap...');

    // Buscar todos os documentos ativos com suas resinas
    const { data: documents, error } = await supabase
      .from('resin_documents')
      .select(`
        id,
        document_name,
        file_url,
        updated_at,
        resins!inner(name, manufacturer, slug)
      `)
      .eq('active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    const baseUrl = 'https://parametros.smartdent.com.br';
    const now = new Date().toISOString().split('T')[0];

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Adicionar cada documento ao sitemap
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const lastmod = doc.updated_at 
          ? new Date(doc.updated_at).toISOString().split('T')[0] 
          : now;
        
        const resin = doc.resins as any;
        
        sitemap += `
  <!-- Documento: ${doc.document_name} (${resin.name}) -->
  <url>
    <loc>${doc.file_url}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    sitemap += `
</urlset>`;

    console.log(`Generated documents sitemap with ${documents?.length || 0} PDFs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache 24h
      },
    });
  } catch (error) {
    console.error('Error generating documents sitemap:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
