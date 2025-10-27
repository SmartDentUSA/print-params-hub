import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    console.log(`[knowledge-feed] Request: format=${format}, limit=${limit}`);

    // 1. Buscar IDs das categorias C, D, E
    const { data: categories, error: categoriesError } = await supabase
      .from('knowledge_categories')
      .select('id')
      .in('letter', ['C', 'D', 'E']);

    if (categoriesError) {
      console.error('[knowledge-feed] Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    const categoryIds = categories?.map((c) => c.id) || [];
    console.log(`[knowledge-feed] Found ${categoryIds.length} categories (C, D, E)`);

    if (categoryIds.length === 0) {
      console.warn('[knowledge-feed] No categories found for C, D, E');
      return new Response(
        JSON.stringify({ feed: { title: 'Base de Conhecimento - Smart Dent', items: [] }, items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar artigos apenas dessas categorias
    const { data: contents, error: contentsError } = await supabase
      .from('knowledge_contents')
      .select(`
        id,
        title,
        slug,
        excerpt,
        og_image_url,
        content_image_url,
        created_at,
        updated_at,
        keywords,
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

    if (contentsError) {
      console.error('[knowledge-feed] Error fetching contents:', contentsError);
      throw contentsError;
    }

    console.log(`[knowledge-feed] Found ${contents?.length || 0} articles`);
    console.log(`[knowledge-feed] Articles with authors: ${contents?.filter((c: any) => c.authors).length || 0}/${contents?.length || 0}`);

    const baseUrl = 'https://smartdent.com.br';

    // JSON Format
    if (format === 'json') {
      const jsonFeed = {
        feed: {
          title: 'Base de Conhecimento - Smart Dent',
          link: `${baseUrl}/base-conhecimento`,
          description: 'Artigos sobre Ciência, Tecnologia, Ebooks e Informativos',
          updated_at: new Date().toISOString(),
          categories_included: ['C', 'D', 'E'],
        },
        items: contents?.map((item: any) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          category: {
            name: item.knowledge_categories?.name || 'Sem categoria',
            letter: item.knowledge_categories?.letter || 'A',
          },
          url: `${baseUrl}/base-conhecimento/${item.knowledge_categories?.letter?.toLowerCase() || 'a'}/${item.slug}`,
          image_url: item.og_image_url || item.content_image_url || '',
          published_at: item.created_at,
          updated_at: item.updated_at,
          keywords: item.keywords || [],
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
          'Pragma': 'no-cache',
          'Expires': '0',
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
      <description><![CDATA[${item.excerpt}]]></description>
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
    <title>Base de Conhecimento - Smart Dent (C, D, E)</title>
    <link>${baseUrl}/base-conhecimento</link>
    <description>Artigos curados sobre Ciência, Tecnologia, Ebooks e Informativos</description>
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
          'Pragma': 'no-cache',
          'Expires': '0',
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
    <summary type="html"><![CDATA[${item.excerpt}]]></summary>
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
  <title>Base de Conhecimento - Smart Dent (C, D, E)</title>
  <link href="${baseUrl}/base-conhecimento" />
  <link href="${baseUrl}/feed.atom" rel="self" />
  <updated>${new Date().toISOString()}</updated>
  <id>${baseUrl}/base-conhecimento</id>
  <subtitle>Artigos curados sobre Ciência, Tecnologia, Ebooks e Informativos</subtitle>${atomEntries}
</feed>`;

      return new Response(atomFeed, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/atom+xml; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Invalid format
    return new Response(
      JSON.stringify({ error: 'Invalid format. Use: json, rss, or atom' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[knowledge-feed] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
