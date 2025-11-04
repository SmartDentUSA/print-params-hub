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

async function fetchResinDocuments(supabase: any, options: any) {
  let query = supabase
    .from('resin_documents')
    .select(`
      *,
      resins!inner(
        id,
        name,
        manufacturer,
        slug
      )
    `)
    .order('order_index');
  
  if (options.approved_only) {
    query = query.eq('active', true).eq('resins.active', true);
  }
  
  const { data: documents, error } = await query;
  if (error) throw error;
  
  return documents.map((doc: any) => ({
    id: doc.id,
    resin_id: doc.resin_id,
    resin_name: doc.resins.name,
    resin_manufacturer: doc.resins.manufacturer,
    resin_slug: doc.resins.slug,
    document_name: doc.document_name,
    document_description: doc.document_description,
    file_name: doc.file_name,
    file_url: doc.file_url,
    file_size: doc.file_size,
    order_index: doc.order_index,
    active: doc.active,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    // URL público do documento
    public_document_url: doc.file_url,
    // URL da página da resina
    resin_page_url: doc.resins.slug 
      ? `https://parametros.smartdent.com.br/resina/${doc.resins.slug}`
      : null
  }));
}

async function fetchCatalogDocuments(supabase: any, options: any) {
  let query = supabase
    .from('catalog_documents')
    .select(`
      *,
      system_a_catalog!inner(
        id,
        name,
        slug,
        category
      )
    `)
    .order('order_index');
  
  if (options.approved_only) {
    query = query.eq('active', true).eq('system_a_catalog.active', true);
  }
  
  const { data: documents, error } = await query;
  if (error) throw error;
  
  return documents.map((doc: any) => ({
    id: doc.id,
    product_id: doc.product_id,
    product_name: doc.system_a_catalog.name,
    product_slug: doc.system_a_catalog.slug,
    product_category: doc.system_a_catalog.category,
    document_name: doc.document_name,
    document_description: doc.document_description,
    file_name: doc.file_name,
    file_url: doc.file_url,
    file_size: doc.file_size,
    order_index: doc.order_index,
    active: doc.active,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    // URL público do documento
    public_document_url: doc.file_url,
    // URL da página do produto
    product_page_url: doc.system_a_catalog.slug 
      ? `https://parametros.smartdent.com.br/produto/${doc.system_a_catalog.slug}`
      : null
  }));
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
          .select(`
            id, name, manufacturer, image_url, price, slug,
            cta_1_enabled, cta_1_label, cta_1_url, cta_1_description,
            cta_2_label, cta_2_url, cta_2_description, cta_2_source_type, cta_2_source_id,
            cta_3_label, cta_3_url, cta_3_description, cta_3_source_type, cta_3_source_id,
            cta_4_label, cta_4_url, cta_4_description, cta_4_source_type, cta_4_source_id
          `)
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

async function fetchSystemACatalog(supabase: any, options: any) {
  let query = supabase
    .from('system_a_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });
  
  if (options.approved_only) {
    query = query.eq('approved', true).eq('active', true);
  }
  
  const { data: catalog, error } = await query;
  if (error) throw error;
  
  // Group by category
  const grouped: any = {
    company_info: [],
    category_config: [],
    resin: [],
    printer: [],
    accessory: [],
    product: [],
    video_testimonial: [],
    google_review: [],
    kol: [],
    landing_page: []
  };
  
  for (const item of catalog) {
    if (grouped[item.category]) {
      grouped[item.category].push(item);
    }
  }
  
  return {
    items: catalog,
    grouped: grouped,
    stats: {
      total: catalog.length,
      company_info: grouped.company_info.length,
      categories: grouped.category_config.length,
      resins: grouped.resin.length,
      printers: grouped.printer.length,
      accessories: grouped.accessory.length,
      products: grouped.product.length,
      testimonials: grouped.video_testimonial.length,
      reviews: grouped.google_review.length,
      kols: grouped.kol.length,
      landing_pages: grouped.landing_page.length
    }
  };
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
    system_a_catalog: data.system_a_catalog?.stats?.total || 0,
    system_a_products: (data.system_a_catalog?.stats?.resins || 0) + 
                       (data.system_a_catalog?.stats?.printers || 0) + 
                       (data.system_a_catalog?.stats?.accessories || 0),
    resin_documents: data.resin_documents?.length || 0,
    catalog_documents: data.catalog_documents?.length || 0,
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
      color: r.color,
      image_url: r.image_url,
      price: r.price,
      description: r.description,
      
      // Campos de correlação entre sistemas
      external_id: r.external_id,
      system_a_product_id: r.system_a_product_id,
      system_a_product_url: r.system_a_product_url,
      
      // SEO
      seo_title_override: r.seo_title_override,
      meta_description: r.meta_description,
      canonical_url: r.canonical_url,
      og_image_url: r.og_image_url,
      keywords: r.keywords,
      keyword_ids: r.keyword_ids,
      
      // CTAs
      cta_1_enabled: r.cta_1_enabled,
      cta_1_label: r.cta_1_label,
      cta_1_url: r.cta_1_url,
      cta_1_description: r.cta_1_description,
      cta_2_source_type: r.cta_2_source_type,
      cta_2_source_id: r.cta_2_source_id,
      cta_2_label: r.cta_2_label,
      cta_2_url: r.cta_2_url,
      cta_2_description: r.cta_2_description,
      cta_3_source_type: r.cta_3_source_type,
      cta_3_source_id: r.cta_3_source_id,
      cta_3_label: r.cta_3_label,
      cta_3_url: r.cta_3_url,
      cta_3_description: r.cta_3_description,
      cta_4_source_type: r.cta_4_source_type,
      cta_4_source_id: r.cta_4_source_id,
      cta_4_label: r.cta_4_label,
      cta_4_url: r.cta_4_url,
      cta_4_description: r.cta_4_description,
      
      // Metadata
      active: r.active,
      public_url: r.public_url
    })),
    resin_documents: data.resin_documents?.map((doc: any) => ({
      id: doc.id,
      resin_id: doc.resin_id,
      resin_name: doc.resin_name,
      resin_manufacturer: doc.resin_manufacturer,
      document_name: doc.document_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      active: doc.active
    })),
    catalog_documents: data.catalog_documents?.map((doc: any) => ({
      id: doc.id,
      product_id: doc.product_id,
      product_name: doc.product_name,
      document_name: doc.document_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      active: doc.active
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
      parametros: (data.parameter_sets || []).map((ps: any) => ({
        id: ps.id,
        marca: ps.brand_slug,
        modelo: ps.model_slug,
        resina_nome: ps.resin_name,
        resina_fabricante: ps.resin_manufacturer,
        
        // Parâmetros de camada
        altura_camada_mm: ps.layer_height,
        tempo_cura_segundos: ps.cure_time,
        tempo_cura_base_segundos: ps.bottom_cure_time,
        camadas_base: ps.bottom_layers,
        
        // Parâmetros de luz
        intensidade_luz_percentual: ps.light_intensity,
        anti_aliasing: ps.anti_aliasing,
        
        // Parâmetros de movimento
        distancia_elevacao_mm: ps.lift_distance,
        velocidade_elevacao_mm_s: ps.lift_speed,
        velocidade_retracao_mm_s: ps.retract_speed,
        
        // Ajustes dimensionais
        ajuste_xy_x_percentual: ps.xy_adjustment_x_pct,
        ajuste_xy_y_percentual: ps.xy_adjustment_y_pct,
        compensacao_xy_mm: ps.xy_size_compensation,
        
        // Tempos de espera
        tempo_espera_antes_cura_segundos: ps.wait_time_before_cure,
        tempo_espera_depois_cura_segundos: ps.wait_time_after_cure,
        tempo_espera_apos_elevacao_segundos: ps.wait_time_after_lift,
        
        // Metadados
        observacoes: ps.notes,
        ativo: ps.active,
        criado_em: ps.created_at,
        atualizado_em: ps.updated_at
      }))
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
        slug: r.slug,
        
        // Campos de correlação entre sistemas
        correlacao: {
          loja_integrada_id: r.external_id || null,
          sistema_a_product_id: r.system_a_product_id || null,
          sistema_a_product_url: r.system_a_product_url || null
        },
        
        // SEO
        seo_titulo: r.seo_title_override,
        meta_descricao: r.meta_description,
        url_canonica: r.canonical_url,
        imagem_og: r.og_image_url,
        palavras_chave: r.keywords || [],
        keywords_detalhadas: r.keywords_data || [],
        
        // CTAs
        cta_principal: r.cta_1_label ? {
          habilitado: r.cta_1_enabled,
          label: r.cta_1_label,
          url: r.cta_1_url,
          descricao: r.cta_1_description
        } : null,
        cta_secundario: r.cta_2_label ? {
          label: r.cta_2_label,
          url: r.cta_2_url,
          descricao: r.cta_2_description,
          tipo_fonte: r.cta_2_source_type,
          id_fonte: r.cta_2_source_id
        } : null,
        cta_terciario: r.cta_3_label ? {
          label: r.cta_3_label,
          url: r.cta_3_url,
          descricao: r.cta_3_description,
          tipo_fonte: r.cta_3_source_type,
          id_fonte: r.cta_3_source_id
        } : null,
        cta_quaternario: r.cta_4_label ? {
          label: r.cta_4_label,
          url: r.cta_4_url,
          descricao: r.cta_4_description,
          tipo_fonte: r.cta_4_source_type,
          id_fonte: r.cta_4_source_id
        } : null,
        
        // Metadata
        url_publica: r.public_url,
        quantidade_parametros: r.parameter_sets_count || 0,
        ativo: r.active
      })),
      documentos_tecnicos: (data.resin_documents || []).map((doc: any) => ({
        id: doc.id,
        resina: {
          id: doc.resin_id,
          nome: doc.resin_name,
          fabricante: doc.resin_manufacturer,
          slug: doc.resin_slug,
          url_pagina: doc.resin_page_url
        },
        documento: {
          nome: doc.document_name,
          descricao: doc.document_description,
          nome_arquivo: doc.file_name,
          url_download: doc.file_url,
          tamanho_bytes: doc.file_size
        },
        ordem_exibicao: doc.order_index,
        ativo: doc.active,
        criado_em: doc.created_at,
        atualizado_em: doc.updated_at
      })),
      documentos_catalogo: (data.catalog_documents || []).map((doc: any) => ({
        id: doc.id,
        produto: {
          id: doc.product_id,
          nome: doc.product_name,
          slug: doc.product_slug,
          categoria: doc.product_category,
          url_pagina: doc.product_page_url
        },
        documento: {
          nome: doc.document_name,
          descricao: doc.document_description,
          nome_arquivo: doc.file_name,
          url_download: doc.file_url,
          tamanho_bytes: doc.file_size
        },
        ordem_exibicao: doc.order_index,
        ativo: doc.active,
        criado_em: doc.created_at,
        atualizado_em: doc.updated_at
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
    })),
    catalogo_sistema_a: data.system_a_catalog ? {
      estatisticas: data.system_a_catalog.stats,
      perfil_empresa: (data.system_a_catalog.grouped.company_info || []).map((item: any) => ({
        id: item.id,
        nome: item.name,
        descricao: item.description,
        imagem: item.image_url,
        url_canonica: item.canonical_url,
        titulo_seo: item.seo_title_override,
        dados_completos: item.extra_data
      })),
      configuracoes_categorias: (data.system_a_catalog.grouped.category_config || []).map((item: any) => ({
        id: item.id,
        categoria: item.name,
        subcategoria: item.description,
        palavras_chave: item.keywords || [],
        keyword_ids: item.keyword_ids || [],
        dados_adicionais: item.extra_data
      })),
      resinas_3d: (data.system_a_catalog.grouped.resin || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        nome: item.name,
        slug: item.slug,
        descricao: item.description,
        imagem: item.image_url,
        preco: item.price,
        preco_promocional: item.promo_price,
        moeda: item.currency,
        titulo_seo: item.seo_title_override,
        meta_descricao: item.meta_description,
        url_canonica: item.canonical_url,
        imagem_og: item.og_image_url,
        palavras_chave: item.keywords || [],
        keyword_ids: item.keyword_ids || [],
        ctas: {
          cta1: item.cta_1_label ? {
            label: item.cta_1_label,
            url: item.cta_1_url,
            descricao: item.cta_1_description
          } : null,
          cta2: item.cta_2_label ? {
            label: item.cta_2_label,
            url: item.cta_2_url,
            descricao: item.cta_2_description
          } : null,
          cta3: item.cta_3_label ? {
            label: item.cta_3_label,
            url: item.cta_3_url,
            descricao: item.cta_3_description
          } : null
        },
        avaliacao: item.rating,
        dados_completos: item.extra_data
      })),
      impressoras_3d: (data.system_a_catalog.grouped.printer || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        nome: item.name,
        slug: item.slug,
        descricao: item.description,
        imagem: item.image_url,
        preco: item.price,
        preco_promocional: item.promo_price,
        titulo_seo: item.seo_title_override,
        meta_descricao: item.meta_description,
        palavras_chave: item.keywords || [],
        keyword_ids: item.keyword_ids || [],
        ctas: {
          cta1: item.cta_1_label ? { label: item.cta_1_label, url: item.cta_1_url } : null,
          cta2: item.cta_2_label ? { label: item.cta_2_label, url: item.cta_2_url } : null,
          cta3: item.cta_3_label ? { label: item.cta_3_label, url: item.cta_3_url } : null
        },
        dados_completos: item.extra_data
      })),
      acessorios: (data.system_a_catalog.grouped.accessory || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        nome: item.name,
        slug: item.slug,
        descricao: item.description,
        imagem: item.image_url,
        preco: item.price,
        titulo_seo: item.seo_title_override,
        palavras_chave: item.keywords || [],
        dados_completos: item.extra_data
      })),
      depoimentos_video: (data.system_a_catalog.grouped.video_testimonial || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        cliente: item.name,
        depoimento: item.description,
        imagem: item.image_url,
        avaliacao: item.rating,
        dados_completos: item.extra_data
      })),
      avaliacoes_google: (data.system_a_catalog.grouped.google_review || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        autor: item.name,
        avaliacao_texto: item.description,
        foto_perfil: item.image_url,
        nota: item.rating,
        dados_completos: item.extra_data
      })),
      lideres_opiniao: (data.system_a_catalog.grouped.kol || []).map((item: any) => ({
        id: item.id,
        external_id: item.external_id,
        nome: item.name,
        mini_cv: item.description,
        foto: item.image_url,
        dados_completos: item.extra_data
      }))
    } : null
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
    let bodyParams: any = {};
    
    // Parse POST body if present
    if (req.method === 'POST') {
      try {
        bodyParams = await req.json();
      } catch (e) {
        console.log('No JSON body, using query params');
      }
    }
    
    // Parse query parameters (GET) or body parameters (POST), with body taking precedence
    const options = {
      format: bodyParams.format || url.searchParams.get('format') || 'full',
      include_brands: bodyParams.include_brands !== undefined 
        ? bodyParams.include_brands 
        : url.searchParams.get('include_brands') !== 'false',
      include_models: bodyParams.include_models !== undefined 
        ? bodyParams.include_models 
        : url.searchParams.get('include_models') !== 'false',
      include_parameters: bodyParams.include_parameter_sets !== undefined 
        ? bodyParams.include_parameter_sets 
        : bodyParams.include_parameters !== undefined
        ? bodyParams.include_parameters
        : url.searchParams.get('include_parameters') !== 'false',
      include_resins: bodyParams.include_resins !== undefined 
        ? bodyParams.include_resins 
        : url.searchParams.get('include_resins') !== 'false',
      include_resin_documents: bodyParams.include_resin_documents !== undefined 
        ? bodyParams.include_resin_documents 
        : url.searchParams.get('include_resin_documents') !== 'false',
      include_knowledge: bodyParams.include_knowledge_contents !== undefined
        ? bodyParams.include_knowledge_contents 
        : bodyParams.include_knowledge !== undefined
        ? bodyParams.include_knowledge
        : url.searchParams.get('include_knowledge') !== 'false',
      include_categories: bodyParams.include_knowledge_categories !== undefined 
        ? bodyParams.include_knowledge_categories 
        : bodyParams.include_categories !== undefined
        ? bodyParams.include_categories
        : url.searchParams.get('include_categories') !== 'false',
      include_keywords: bodyParams.include_external_links !== undefined 
        ? bodyParams.include_external_links 
        : bodyParams.include_keywords !== undefined
        ? bodyParams.include_keywords
        : url.searchParams.get('include_keywords') !== 'false',
      include_authors: bodyParams.include_authors !== undefined 
        ? bodyParams.include_authors 
        : url.searchParams.get('include_authors') !== 'false',
      include_system_a: bodyParams.include_system_a_catalog !== undefined 
        ? bodyParams.include_system_a_catalog 
        : bodyParams.include_system_a !== undefined
        ? bodyParams.include_system_a
        : url.searchParams.get('include_system_a') !== 'false',
      include_catalog_documents: bodyParams.include_catalog_documents !== undefined 
        ? bodyParams.include_catalog_documents 
        : url.searchParams.get('include_catalog_documents') !== 'false',
      denormalize: bodyParams.denormalize !== undefined
        ? bodyParams.denormalize 
        : url.searchParams.get('denormalize') !== 'false',
      extract_text: bodyParams.extract_text !== undefined 
        ? bodyParams.extract_text 
        : url.searchParams.get('extract_text') !== 'false',
      approved_only: bodyParams.approved_only !== undefined 
        ? bodyParams.approved_only 
        : url.searchParams.get('approved_only') !== 'false',
      limit_contents: bodyParams.limit_contents || 
        (url.searchParams.get('limit_contents') 
          ? parseInt(url.searchParams.get('limit_contents')!) 
          : null),
      with_stats: bodyParams.with_stats !== undefined 
        ? bodyParams.with_stats 
        : url.searchParams.get('with_stats') !== 'false'
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
    
    if (options.include_resin_documents) {
      promises.push(
        fetchResinDocuments(supabase, options)
          .then(d => { data.resin_documents = d; })
          .catch(err => console.error('Error fetching resin_documents:', err))
      );
    }
    
    if (options.include_catalog_documents) {
      promises.push(
        fetchCatalogDocuments(supabase, options)
          .then(d => { data.catalog_documents = d; })
          .catch(err => console.error('Error fetching catalog_documents:', err))
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
    
    if (options.include_system_a) {
      promises.push(
        fetchSystemACatalog(supabase, options)
          .then(d => { data.system_a_catalog = d; })
          .catch(err => console.error('Error fetching system_a_catalog:', err))
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
