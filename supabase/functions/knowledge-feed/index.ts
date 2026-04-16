import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function deduplicateFaqs(faqs: any[]): any[] {
  if (!faqs || !Array.isArray(faqs)) return [];
  const seen = new Set<string>();
  return faqs.filter((faq: any) => {
    const key = faq?.question?.trim()?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const categoriesParam = url.searchParams.get('categories'); // e.g. "A,B,C"

    console.log(`[knowledge-feed] Request: format=${format}, limit=${limit}, categories=${categoriesParam || 'all'}`);

    // Build category filter
    let categoryIds: string[] = [];
    
    if (categoriesParam) {
      // Filter by specific categories
      const letters = categoriesParam.split(',').map(l => l.trim().toUpperCase());
      const { data: categories, error: categoriesError } = await supabase
        .from('knowledge_categories')
        .select('id')
        .in('letter', letters);
      if (categoriesError) throw categoriesError;
      categoryIds = categories?.map((c: any) => c.id) || [];
    } else {
      // All categories A-F (exclude G which is support/internal)
      const { data: categories, error: categoriesError } = await supabase
        .from('knowledge_categories')
        .select('id')
        .in('letter', ['A', 'B', 'C', 'D', 'E', 'F']);
      if (categoriesError) throw categoriesError;
      categoryIds = categories?.map((c: any) => c.id) || [];
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('knowledge_contents')
      .select('id', { count: 'exact', head: true })
      .in('category_id', categoryIds)
      .eq('active', true);

    console.log(`[knowledge-feed] Total active articles: ${totalCount}`);

    if (totalCount === 0) {
      return new Response(
        JSON.stringify({ feed: { title: 'Base de Conhecimento - Smart Dent', total_count: 0, items: [] }, items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch articles with all translated fields
    const { data: contents, error: contentsError } = await supabase
      .from('knowledge_contents')
      .select(`
        id,
        title,
        title_en,
        title_es,
        slug,
        excerpt,
        excerpt_en,
        excerpt_es,
        meta_description,
        og_image_url,
        content_image_url,
        content_image_alt,
        faqs,
        faqs_en,
        faqs_es,
        created_at,
        updated_at,
        keywords,
        veredict_data,
        answer_block,
        technical_properties,
        recommended_products,
        recommended_resins,
        is_medical_device,
        is_scholarly,
        norm_references,
        geo_city,
        geo_state,
        geo_state_code,
        client_name,
        client_specialty,
        ai_context,
        ai_context_en,
        ai_context_es,
        knowledge_categories(name, letter),
        authors(
          id,
          name,
          specialty,
          photo_url,
          mini_bio,
          lattes_url,
          instagram_url,
          linkedin_url,
          facebook_url,
          youtube_url,
          twitter_url,
          website_url
        )
      `)
      .in('category_id', categoryIds)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (contentsError) throw contentsError;

    console.log(`[knowledge-feed] Found ${contents?.length || 0} articles`);

    const baseUrl = 'https://parametros.smartdent.com.br';

    // JSON Format
    if (format === 'json') {
      const jsonFeed = {
        feed: {
          title: 'Base de Conhecimento - Smart Dent',
          link: `${baseUrl}/base-conhecimento`,
          description: 'Artigos sobre Ciência, Tecnologia, Ebooks, Informativos, Vídeos, Troubleshooting e Parâmetros',
          updated_at: new Date().toISOString(),
          categories_included: categoriesParam ? categoriesParam.split(',').map(l => l.trim().toUpperCase()) : ['A', 'B', 'C', 'D', 'E', 'F'],
          version: '2.0',
        },
        items: contents?.map((item: any) => ({
          id: item.id,
          title: item.title,
          title_en: item.title_en || null,
          title_es: item.title_es || null,
          slug: item.slug,
          excerpt: item.excerpt,
          excerpt_en: item.excerpt_en || null,
          excerpt_es: item.excerpt_es || null,
          meta_description: item.meta_description || item.excerpt,
          category: {
            name: item.knowledge_categories?.name || 'Sem categoria',
            letter: item.knowledge_categories?.letter || 'A',
          },
          url: `${baseUrl}/base-conhecimento/${item.knowledge_categories?.letter?.toLowerCase() || 'a'}/${item.slug}`,
          image_url: item.og_image_url || item.content_image_url || '',
          image_alt: item.content_image_alt || item.title,
          published_at: item.created_at,
          updated_at: item.updated_at,
          keywords: item.keywords || [],
          faqs: deduplicateFaqs(item.faqs),
          faqs_en: deduplicateFaqs(item.faqs_en),
          faqs_es: deduplicateFaqs(item.faqs_es),
          
          // Enriched content
          veredict_data: item.veredict_data || null,
          answer_block: item.answer_block || null,
          technical_properties: item.technical_properties || null,
          recommended_products: item.recommended_products || null,
          recommended_resins: item.recommended_resins || null,
          
          // Scientific metadata
          is_medical_device: item.is_medical_device || false,
          is_scholarly: item.is_scholarly || false,
          norm_references: item.norm_references || null,
          
          // Geolocation (testimonials)
          geo: (item.geo_city || item.geo_state) ? {
            city: item.geo_city,
            state: item.geo_state,
            state_code: item.geo_state_code,
            client_name: item.client_name,
            client_specialty: item.client_specialty,
          } : null,
          
          // AI context
          ai_context: item.ai_context || null,
          ai_context_en: item.ai_context_en || null,
          ai_context_es: item.ai_context_es || null,
          
          author: item.authors ? {
            id: item.authors.id,
            name: item.authors.name,
            specialty: item.authors.specialty,
            photo_url: item.authors.photo_url,
            mini_bio: item.authors.mini_bio,
            lattes_url: item.authors.lattes_url,
            social_links: {
              instagram: item.authors.instagram_url,
              linkedin: item.authors.linkedin_url,
              facebook: item.authors.facebook_url,
              youtube: item.authors.youtube_url,
              twitter: item.authors.twitter_url,
              website: item.authors.website_url,
            },
          } : null,
        })) || [],
      };

      return new Response(JSON.stringify(jsonFeed), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // RSS 2.0 Format
    if (format === 'rss') {
      const rssItems = contents?.map((item: any) => {
        const pubDate = new Date(item.created_at).toUTCString();
        const link = `${baseUrl}/base-conhecimento/${item.knowledge_categories?.letter?.toLowerCase() || 'a'}/${item.slug}`;
        
        return `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${link}</link>
      <description><![CDATA[${item.meta_description || item.excerpt}]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${item.id}</guid>
      <category>${item.knowledge_categories?.name || 'Sem categoria'}</category>
      ${item.og_image_url ? `<enclosure url="${item.og_image_url}" type="image/jpeg" />` : ''}
      ${item.authors ? `<dc:creator><![CDATA[${item.authors.name}]]></dc:creator>` : ''}
    </item>`;
      }).join('') || '';

      const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Base de Conhecimento - Smart Dent</title>
    <link>${baseUrl}/base-conhecimento</link>
    <description>Artigos curados sobre Impressão 3D Odontológica</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.rss" rel="self" type="application/rss+xml" />${rssItems}
  </channel>
</rss>`;

      return new Response(rssFeed, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Atom 1.0 Format
    if (format === 'atom') {
      const atomEntries = contents?.map((item: any) => {
        const updated = new Date(item.updated_at).toISOString();
        const published = new Date(item.created_at).toISOString();
        const link = `${baseUrl}/base-conhecimento/${item.knowledge_categories?.letter?.toLowerCase() || 'a'}/${item.slug}`;
        
        return `
  <entry>
    <title>${item.title}</title>
    <link href="${link}" />
    <id>urn:uuid:${item.id}</id>
    <updated>${updated}</updated>
    <published>${published}</published>
    <summary type="html"><![CDATA[${item.meta_description || item.excerpt}]]></summary>
    <category term="${item.knowledge_categories?.name || 'Sem categoria'}" />
    ${item.authors ? `
    <author>
      <name>${item.authors.name}</name>
      ${item.authors.website_url ? `<uri>${item.authors.website_url}</uri>` : ''}
    </author>` : ''}
  </entry>`;
      }).join('') || '';

      const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Base de Conhecimento - Smart Dent</title>
  <link href="${baseUrl}/base-conhecimento" />
  <link href="${baseUrl}/feed.atom" rel="self" />
  <updated>${new Date().toISOString()}</updated>
  <id>${baseUrl}/base-conhecimento</id>
  <subtitle>Artigos curados sobre Impressão 3D Odontológica</subtitle>${atomEntries}
</feed>`;

      return new Response(atomFeed, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/atom+xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid format. Use: json, rss, or atom' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[knowledge-feed] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
