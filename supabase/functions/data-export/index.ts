import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== HELPER FUNCTIONS =====

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  
  if (url.includes('youtube.com/watch?v=')) {
    const match = url.match(/v=([^&]+)/);
    return match ? match[1] : null;
  }
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : null;
  }
  if (url.includes('youtube.com/embed/')) {
    const match = url.match(/embed\/([^?]+)/);
    return match ? match[1] : null;
  }
  return null;
}

function getEmbedUrl(url: string): string {
  const videoId = extractVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

// ===== FETCH FUNCTIONS =====

async function fetchBrands(supabase: any, options: any) {
  let query = supabase
    .from('brands')
    .select('*')
    .order('name');
  
  if (options.approved_only) {
    query = query.eq('active', true);
  }
  
  const { data: brands, error } = await query;
  if (error) throw error;
  
  // Count models for each brand
  if (options.denormalize) {
    for (const brand of brands) {
      const { count } = await supabase
        .from('models')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .eq('active', true);
      
      brand.models_count = count || 0;
    }
  }
  
  return brands;
}

async function fetchModels(supabase: any, options: any) {
  let query = supabase
    .from('models')
    .select('*, brands!inner(name, slug)')
    .order('name');
  
  if (options.approved_only) {
    query = query.eq('active', true).eq('brands.active', true);
  }
  
  const { data: models, error } = await query;
  if (error) throw error;
  
  return models.map((model: any) => {
    const result: any = {
      ...model,
      brand_name: model.brands.name,
      brand_slug: model.brands.slug,
    };
    
    // Remove nested brands object in compact mode
    if (!options.denormalize) {
      delete result.brands;
    }
    
    return result;
  });
}

async function fetchParameterSets(supabase: any, options: any) {
  let query = supabase
    .from('parameter_sets')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (options.approved_only) {
    query = query.eq('active', true);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data;
}

async function fetchResins(supabase: any, options: any) {
  let query = supabase
    .from('resins')
    .select('*')
    .order('name');
  
  if (options.approved_only) {
    query = query.eq('active', true);
  }
  
  const { data: resins, error } = await query;
  if (error) throw error;
  
  // Denormalize keywords and count parameter sets
  if (options.denormalize) {
    for (const resin of resins) {
      // Fetch keywords
      if (resin.keyword_ids && resin.keyword_ids.length > 0) {
        const { data: keywords } = await supabase
          .from('external_links')
          .select('id, name, url, monthly_searches, search_intent')
          .in('id', resin.keyword_ids);
        
        resin.keywords_data = keywords || [];
      } else {
        resin.keywords_data = [];
      }
      
      // Count parameter sets using this resin
      const { count } = await supabase
        .from('parameter_sets')
        .select('id', { count: 'exact', head: true })
        .eq('resin_name', resin.name)
        .eq('resin_manufacturer', resin.manufacturer)
        .eq('active', true);
      
      resin.parameter_sets_count = count || 0;
      
      // Add public URL
      resin.public_url = resin.slug 
        ? `https://parametros.smartdent.com.br/resina/${resin.slug}`
        : null;
    }
  }
  
  return resins;
}

async function fetchKnowledgeCategories(supabase: any, options: any) {
  let query = supabase
    .from('knowledge_categories')
    .select('*')
    .order('order_index');
  
  if (options.approved_only) {
    query = query.eq('enabled', true);
  }
  
  const { data: categories, error } = await query;
  if (error) throw error;
  
  // Count contents in each category
  if (options.denormalize) {
    for (const category of categories) {
      const { count } = await supabase
        .from('knowledge_contents')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', category.id)
        .eq('active', true);
      
      category.contents_count = count || 0;
    }
  }
  
  return categories;
}

async function fetchKnowledgeContents(supabase: any, options: any) {
  let query = supabase
    .from('knowledge_contents')
    .select('*, knowledge_categories(*), authors(*)')
    .order('updated_at', { ascending: false });
  
  if (options.approved_only) {
    query = query.eq('active', true);
  }
  
  if (options.limit_contents) {
    query = query.limit(options.limit_contents);
  }
  
  const { data: contents, error } = await query;
  if (error) throw error;
  
  // Process each content
  for (const content of contents) {
    // Extract text from HTML
    if (options.extract_text && content.content_html) {
      content.content_text = stripHtmlTags(content.content_html);
    }
    
    // Fetch videos
    const { data: videos } = await supabase
      .from('knowledge_videos')
      .select('*')
      .eq('content_id', content.id)
      .order('order_index');
    
    content.videos = (videos || []).map((v: any) => ({
      ...v,
      embed_url: getEmbedUrl(v.url)
    }));
    
    // Denormalize relationships
    if (options.denormalize) {
      // Denormalize recommended resins
      if (content.recommended_resins && content.recommended_resins.length > 0) {
        const { data: resins } = await supabase
          .from('resins')
          .select('id, name, manufacturer, image_url, cta_1_url, price')
          .in('id', content.recommended_resins);
        
        content.recommended_resins_data = resins || [];
      } else {
        content.recommended_resins_data = [];
      }
      
      // Denormalize keywords
      if (content.keyword_ids && content.keyword_ids.length > 0) {
        const { data: keywords } = await supabase
          .from('external_links')
          .select('id, name, url, search_intent, monthly_searches')
          .in('id', content.keyword_ids);
        
        content.keywords_data = keywords || [];
      } else {
        content.keywords_data = [];
      }
      
      // Denormalize author
      if (content.authors) {
        content.author_name = content.authors.name;
        content.author_specialty = content.authors.specialty;
        content.author_photo_url = content.authors.photo_url;
        content.author_mini_bio = content.authors.mini_bio;
        content.author_social_links = {
          instagram_url: content.authors.instagram_url,
          youtube_url: content.authors.youtube_url,
          website_url: content.authors.website_url,
          lattes_url: content.authors.lattes_url,
          facebook_url: content.authors.facebook_url,
          linkedin_url: content.authors.linkedin_url,
          twitter_url: content.authors.twitter_url,
          tiktok_url: content.authors.tiktok_url,
        };
      }
    }
    
    // Denormalize category
    if (content.knowledge_categories) {
      content.category_name = content.knowledge_categories.name;
      content.category_letter = content.knowledge_categories.letter;
    }
    
    // Add public URLs
    const letter = content.knowledge_categories?.letter?.toLowerCase() || 'a';
    content.public_url = `https://parametros.smartdent.com.br/base-conhecimento/${letter}/${content.slug}`;
    content.seo_proxy_url = content.public_url;
  }
  
  return contents;
}

async function fetchKnowledgeVideos(supabase: any) {
  const { data: videos, error } = await supabase
    .from('knowledge_videos')
    .select('*, knowledge_contents(title)')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (videos || []).map((v: any) => ({
    ...v,
    content_title: v.knowledge_contents?.title,
    embed_url: getEmbedUrl(v.url)
  }));
}

async function fetchKeywords(supabase: any, options: any) {
  let query = supabase
    .from('external_links')
    .select('*')
    .order('relevance_score', { ascending: false });
  
  if (options.approved_only) {
    query = query.eq('approved', true);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data;
}

async function fetchAuthors(supabase: any, options: any) {
  let query = supabase
    .from('authors')
    .select('*')
    .order('order_index');
  
  if (options.approved_only) {
    query = query.eq('active', true);
  }
  
  const { data: authors, error } = await query;
  if (error) throw error;
  
  // Count articles for each author
  if (options.denormalize) {
    for (const author of authors) {
      const { count } = await supabase
        .from('knowledge_contents')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', author.id)
        .eq('active', true);
      
      author.articles_count = count || 0;
    }
  }
  
  return authors;
}

// ===== STATS & FORMAT FUNCTIONS =====

function calculateStats(data: any) {
  const htmlSize = data.knowledge_contents
    ?.reduce((acc: number, c: any) => acc + (c.content_html?.length || 0), 0) || 0;
  
  const videosCount = data.knowledge_contents
    ?.reduce((acc: number, c: any) => acc + (c.videos?.length || 0), 0) || 0;
  
  return {
    brands: data.brands?.length || 0,
    models: data.models?.length || 0,
    parameter_sets: data.parameter_sets?.length || 0,
    resins: data.resins?.length || 0,
    knowledge_categories: data.knowledge_categories?.length || 0,
    knowledge_contents: data.knowledge_contents?.length || 0,
    knowledge_videos: videosCount,
    keywords: data.keywords?.length || 0,
    authors: data.authors?.length || 0,
    total_html_size_mb: (htmlSize / 1024 / 1024).toFixed(2)
  };
}

function formatCompact(data: any) {
  return {
    brands: data.brands?.map((b: any) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo_url: b.logo_url,
      active: b.active
    })),
    models: data.models?.map((m: any) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      brand_id: m.brand_id,
      brand_name: m.brand_name,
      brand_slug: m.brand_slug,
      image_url: m.image_url,
      active: m.active
    })),
    parameter_sets: data.parameter_sets?.map((ps: any) => ({
      id: ps.id,
      brand_slug: ps.brand_slug,
      model_slug: ps.model_slug,
      resin_name: ps.resin_name,
      resin_manufacturer: ps.resin_manufacturer,
      layer_height: ps.layer_height,
      cure_time: ps.cure_time,
      active: ps.active
    })),
    resins: data.resins?.map((r: any) => ({
      id: r.id,
      name: r.name,
      manufacturer: r.manufacturer,
      slug: r.slug,
      type: r.type,
      keyword_ids: r.keyword_ids,
      active: r.active
    })),
    knowledge_categories: data.knowledge_categories,
    knowledge_contents: data.knowledge_contents?.map((c: any) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      excerpt: c.excerpt,
      category_id: c.category_id,
      category_name: c.category_name,
      category_letter: c.category_letter,
      author_id: c.author_id,
      keyword_ids: c.keyword_ids,
      recommended_resins: c.recommended_resins,
      public_url: c.public_url,
      active: c.active
    })),
    keywords: data.keywords,
    authors: data.authors
  };
}

function formatAiReady(data: any) {
  return {
    context: {
      company: "Smart Dent",
      domain: "Impressão 3D Odontológica",
      website: "https://parametros.smartdent.com.br",
      last_sync: new Date().toISOString()
    },
    parametrizacao: {
      marcas: data.brands || [],
      modelos: data.models || [],
      parametros: data.parameter_sets || []
    },
    produtos: {
      resinas: (data.resins || []).map((r: any) => ({
        id: r.id,
        nome: r.name,
        fabricante: r.manufacturer,
        descricao: r.description,
        tipo: r.type,
        cor: r.color,
        preco: r.price,
        imagem: r.image_url,
        seo_titulo: r.seo_title_override,
        meta_descricao: r.meta_description,
        palavras_chave: r.keywords || [],
        keywords_detalhadas: r.keywords_data || [],
        cta_principal: r.cta_1_label ? {
          label: r.cta_1_label,
          url: r.cta_1_url,
          descricao: r.cta_1_description
        } : null,
        cta_secundario: r.cta_2_label ? {
          label: r.cta_2_label,
          url: r.cta_2_url,
          descricao: r.cta_2_description
        } : null,
        cta_terciario: r.cta_3_label ? {
          label: r.cta_3_label,
          url: r.cta_3_url,
          descricao: r.cta_3_description
        } : null,
        url_publica: r.public_url,
        quantidade_parametros: r.parameter_sets_count || 0
      }))
    },
    conhecimento: {
      categorias: (data.knowledge_categories || []).map((c: any) => ({
        id: c.id,
        nome: c.name,
        letra: c.letter,
        quantidade_artigos: c.contents_count || 0,
        habilitado: c.enabled
      })),
      artigos: (data.knowledge_contents || []).map((c: any) => ({
        id: c.id,
        titulo: c.title,
        slug: c.slug,
        categoria: c.category_name,
        categoria_letra: c.category_letter,
        resumo: c.excerpt,
        conteudo_html: c.content_html,
        conteudo_texto: c.content_text || stripHtmlTags(c.content_html || ''),
        imagem: c.content_image_url,
        imagem_alt: c.content_image_alt,
        meta_descricao: c.meta_description,
        palavras_chave: c.keywords || [],
        keywords_detalhadas: c.keywords_data || [],
        cor_icone: c.icon_color,
        autor: c.author_name ? {
          id: c.author_id,
          nome: c.author_name,
          especialidade: c.author_specialty,
          foto: c.author_photo_url,
          mini_bio: c.author_mini_bio,
          redes_sociais: c.author_social_links
        } : null,
        videos: (c.videos || []).map((v: any) => ({
          id: v.id,
          titulo: v.title,
          url: v.url,
          embed_url: v.embed_url
        })),
        faqs: c.faqs || [],
        resinas_recomendadas: (c.recommended_resins_data || []).map((r: any) => ({
          id: r.id,
          nome: r.name,
          fabricante: r.manufacturer,
          imagem: r.image_url,
          link: r.cta_1_url,
          preco: r.price
        })),
        arquivo_download: c.file_url ? {
          url: c.file_url,
          nome: c.file_name
        } : null,
        url_publica: c.public_url,
        url_seo_proxy: c.seo_proxy_url
      }))
    },
    keywords: {
      seo: (data.keywords || []).map((k: any) => ({
        id: k.id,
        nome: k.name,
        url: k.url,
        descricao: k.description,
        categoria: k.category,
        subcategoria: k.subcategory,
        tipo: k.keyword_type,
        intencao_busca: k.search_intent,
        buscas_mensais: k.monthly_searches,
        cpc_estimado: k.cpc_estimate,
        nivel_competicao: k.competition_level,
        pontuacao_relevancia: k.relevance_score,
        keywords_relacionadas: k.related_keywords || [],
        aprovado: k.approved,
        gerado_por_ia: k.ai_generated,
        quantidade_usos: k.usage_count
      }))
    },
    autores: (data.authors || []).map((a: any) => ({
      id: a.id,
      nome: a.name,
      especialidade: a.specialty,
      foto: a.photo_url,
      mini_bio: a.mini_bio,
      bio_completa: a.full_bio,
      quantidade_artigos: a.articles_count || 0,
      redes_sociais: {
        lattes: a.lattes_url,
        website: a.website_url,
        instagram: a.instagram_url,
        youtube: a.youtube_url,
        facebook: a.facebook_url,
        linkedin: a.linkedin_url,
        twitter: a.twitter_url,
        tiktok: a.tiktok_url
      }
    }))
  };
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    
    // Parse query parameters
    const options = {
      format: url.searchParams.get('format') || 'full',
      include_brands: url.searchParams.get('include_brands') !== 'false',
      include_models: url.searchParams.get('include_models') !== 'false',
      include_parameters: url.searchParams.get('include_parameters') !== 'false',
      include_resins: url.searchParams.get('include_resins') !== 'false',
      include_knowledge: url.searchParams.get('include_knowledge') !== 'false',
      include_categories: url.searchParams.get('include_categories') !== 'false',
      include_keywords: url.searchParams.get('include_keywords') !== 'false',
      include_authors: url.searchParams.get('include_authors') !== 'false',
      denormalize: url.searchParams.get('denormalize') !== 'false',
      extract_text: url.searchParams.get('extract_text') !== 'false',
      approved_only: url.searchParams.get('approved_only') !== 'false',
      limit_contents: url.searchParams.get('limit_contents') 
        ? parseInt(url.searchParams.get('limit_contents')!) 
        : null,
      with_stats: url.searchParams.get('with_stats') !== 'false'
    };
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🔄 Data Export Request:', {
      format: options.format,
      denormalize: options.denormalize,
      extract_text: options.extract_text,
      limit_contents: options.limit_contents
    });
    
    const data: any = {};
    
    // Fetch all data in parallel
    const promises = [];
    
    if (options.include_brands) {
      promises.push(
        fetchBrands(supabase, options)
          .then(d => { data.brands = d; })
          .catch(err => console.error('Error fetching brands:', err))
      );
    }
    
    if (options.include_models) {
      promises.push(
        fetchModels(supabase, options)
          .then(d => { data.models = d; })
          .catch(err => console.error('Error fetching models:', err))
      );
    }
    
    if (options.include_parameters) {
      promises.push(
        fetchParameterSets(supabase, options)
          .then(d => { data.parameter_sets = d; })
          .catch(err => console.error('Error fetching parameter_sets:', err))
      );
    }
    
    if (options.include_resins) {
      promises.push(
        fetchResins(supabase, options)
          .then(d => { data.resins = d; })
          .catch(err => console.error('Error fetching resins:', err))
      );
    }
    
    if (options.include_categories) {
      promises.push(
        fetchKnowledgeCategories(supabase, options)
          .then(d => { data.knowledge_categories = d; })
          .catch(err => console.error('Error fetching categories:', err))
      );
    }
    
    if (options.include_knowledge) {
      promises.push(
        fetchKnowledgeContents(supabase, options)
          .then(d => { data.knowledge_contents = d; })
          .catch(err => console.error('Error fetching contents:', err))
      );
      
      promises.push(
        fetchKnowledgeVideos(supabase)
          .then(d => { data.knowledge_videos = d; })
          .catch(err => console.error('Error fetching videos:', err))
      );
    }
    
    if (options.include_keywords) {
      promises.push(
        fetchKeywords(supabase, options)
          .then(d => { data.keywords = d; })
          .catch(err => console.error('Error fetching keywords:', err))
      );
    }
    
    if (options.include_authors) {
      promises.push(
        fetchAuthors(supabase, options)
          .then(d => { data.authors = d; })
          .catch(err => console.error('Error fetching authors:', err))
      );
    }
    
    await Promise.all(promises);
    
    console.log('✅ Data fetched successfully');
    
    // Format response based on requested format
    let formattedData = data;
    if (options.format === 'compact') {
      formattedData = formatCompact(data);
    } else if (options.format === 'ai_ready') {
      formattedData = formatAiReady(data);
    }
    
    // Build response object
    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      format: options.format
    };
    
    if (options.with_stats) {
      response.stats = calculateStats(data);
    }
    
    response.data = formattedData;
    
    // Generate ETag for caching
    const responseStr = JSON.stringify(response);
    const etag = `"${responseStr.length}-${Date.now()}"`;
    const ifNoneMatch = req.headers.get('If-None-Match');
    
    // Check if client has cached version
    if (ifNoneMatch === etag) {
      console.log('↩️ Returning 304 Not Modified');
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          'ETag': etag,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    console.log('📦 Returning data:', {
      size_kb: (responseStr.length / 1024).toFixed(2),
      stats: response.stats
    });
    
    return new Response(responseStr, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'ETag': etag
      }
    });
    
  } catch (error) {
    console.error('❌ Data Export Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
