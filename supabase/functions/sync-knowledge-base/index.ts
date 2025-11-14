import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar dados da Knowledge Base API (Sistema A)
    const kbData = await fetchKnowledgeBaseAPI()

    // 2. Sincronizar external_links
    const linksCount = await syncExternalLinks(supabaseClient, kbData.links || [])

    // 3. Sincronizar system_a_catalog (produtos comerciais, vídeos, etc.)
    const catalogStats = await syncSystemACatalog(supabaseClient, kbData)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sincronização concluída com Sistema A',
        total_products_api: kbData?.products?.length || 0,
        stats: {
          keywords: linksCount,
          catalog: {
            inserted: catalogStats.catalog.inserted,
            updated: catalogStats.catalog.updated,
            skipped: catalogStats.catalog.skipped,
            blocked_count: catalogStats.catalog.blocked_reasons.length
          }
        },
        details: {
          catalog: {
            inserted: catalogStats.catalog.inserted,
            updated: catalogStats.catalog.updated,
            skipped: catalogStats.catalog.skipped,
            blocked_count: catalogStats.catalog.blocked_reasons.length,
            blocked_details: catalogStats.catalog.blocked_reasons.slice(0, 10)
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro na sincronização:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function fetchKnowledgeBaseAPI() {
  const apiUrl = new URL('https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base')
  apiUrl.searchParams.set('format', 'system_b')
  apiUrl.searchParams.append('include_company', 'true')
  apiUrl.searchParams.append('include_categories', 'true')
  apiUrl.searchParams.append('include_links', 'true')
  apiUrl.searchParams.append('include_products', 'true')
  apiUrl.searchParams.append('include_video_testimonials', 'true')
  apiUrl.searchParams.append('include_google_reviews', 'true')
  apiUrl.searchParams.append('include_kols', 'true')
  apiUrl.searchParams.append('approved_only', 'true')

  const response = await fetch(apiUrl.toString())
  
  if (!response.ok) {
    throw new Error(`API retornou status ${response.status}`)
  }

  return await response.json()
}

async function syncExternalLinks(supabase: any, links: any[]) {
  if (!links || links.length === 0) return 0

  let count = 0

  for (const link of links) {
    try {
      // Verificar se keyword já existe
      const { data: existing } = await supabase
        .from('external_links')
        .select('id, usage_count, last_used_at')
        .eq('id', link.id)
        .single()

      const linkData = {
        name: link.name,
        url: link.url,
        description: link.description,
        category: link.category,
        subcategory: link.subcategory,
        approved: link.approved,
        keyword_type: link.keyword_type,
        search_intent: link.search_intent,
        monthly_searches: link.monthly_searches,
        cpc_estimate: link.cpc_estimate,
        competition_level: link.competition_level,
        relevance_score: link.relevance_score,
        related_keywords: link.related_keywords,
        source_products: link.source_products,
        ai_generated: link.ai_generated,
      }

      if (existing) {
        // UPDATE (preservar usage_count e last_used_at)
        await supabase
          .from('external_links')
          .update(linkData)
          .eq('id', link.id)
      } else {
        // INSERT
        await supabase
          .from('external_links')
          .insert({
            id: link.id,
            ...linkData,
            usage_count: 0,
          })
      }
      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar keyword "${link.name}":`, err.message)
    }
  }

  return count
}

// Função syncResins() foi removida
// Agora produtos do Sistema A vão APENAS para system_a_catalog
// Resinas técnicas no Sistema B ficam separadas na tabela resins

async function syncSystemACatalog(supabase: any, kbData: any) {
  const stats = {
    company: 0,
    categories: 0,
    catalog: {
      inserted: 0,
      updated: 0,
      skipped: 0,
      blocked_reasons: []
    },
    testimonials: 0,
    reviews: 0,
    kols: 0
  }

  // 1. Company Profile
  if (kbData.company_profile) {
    stats.company = await syncCompanyProfile(supabase, kbData.company_profile)
  }

  // 2. Categories Config
  if (kbData.categories_config && kbData.categories_config.length > 0) {
    stats.categories = await syncCategoriesConfig(supabase, kbData.categories_config)
  }

  // 3. Products (todos os tipos)
  if (kbData.products && kbData.products.length > 0) {
    console.log(`📦 Processando ${kbData.products.length} produtos da API...`)
    stats.catalog = await syncProductsCatalog(supabase, kbData.products)
    console.log(`📊 Resultado: ${stats.catalog.inserted} novos, ${stats.catalog.updated} atualizados, ${stats.catalog.skipped} bloqueados`)
  }

  // 4. Video Testimonials
  if (kbData.video_testimonials && kbData.video_testimonials.length > 0) {
    stats.testimonials = await syncVideoTestimonials(supabase, kbData.video_testimonials)
  }

  // 5. Google Reviews
  if (kbData.google_reviews && kbData.google_reviews.length > 0) {
    stats.reviews = await syncGoogleReviews(supabase, kbData.google_reviews)
  }

  // 6. Key Opinion Leaders
  if (kbData.key_opinion_leaders && kbData.key_opinion_leaders.length > 0) {
    stats.kols = await syncKOLs(supabase, kbData.key_opinion_leaders)
  }

  return stats
}

async function syncCompanyProfile(supabase: any, company: any) {
  if (!company || !company.company_name) return 0

  try {
    const catalogItem = {
      external_id: `company_${company.id || 'main'}`,
      category: 'company_info',
      name: company.company_name || 'Empresa',
      description: company.company_description,
      image_url: company.company_logo_url,
      canonical_url: company.website_url,
      seo_title_override: company.seo_market_positioning,
      extra_data: {
        corporate: {
          mission: company.mission_statement,
          vision: company.vision_statement,
          values: company.brand_values,
          sector: company.business_sector,
          target_audience: company.target_audience,
          differentiators: company.differentiators,
          culture: company.company_culture,
          methodology: company.working_methodology
        },
        contact: {
          email: company.contact_email,
          phone: company.contact_phone,
          location: company.location,
          founded_year: company.founded_year,
          team_size: company.team_size
        },
        seo: {
          competitive_advantages: company.seo_competitive_advantages,
          technical_expertise: company.seo_technical_expertise,
          service_areas: company.seo_service_areas,
          context_keywords: company.seo_context_keywords,
          domains: company.seo_domains
        },
        social_media: company.social_media_links,
        institutional_links: company.institutional_links,
        videos: company.company_videos,
        reviews: company.company_reviews,
        tracking_pixels: company.tracking_pixels
      }
    }

    await supabase
      .from('system_a_catalog')
      .upsert(catalogItem, { onConflict: 'external_id' })

    return 1
  } catch (err) {
    console.error('❌ Erro ao sincronizar company profile:', err.message)
    return 0
  }
}

async function syncCategoriesConfig(supabase: any, categories: any[]) {
  if (!categories || categories.length === 0) return 0

  let count = 0
  for (const cat of categories) {
    try {
      const catalogItem = {
        external_id: `category_${cat.category}_${cat.subcategory || 'main'}`,
        category: 'category_config',
        name: cat.category,
        slug: cat.category.toLowerCase().replace(/\s+/g, '-'),
        description: cat.subcategory,
        keywords: cat.keywords || [],
        keyword_ids: cat.keyword_ids || [],
        extra_data: {
          market_keywords: cat.market_keywords,
          search_intent_keywords: cat.search_intent_keywords,
          target_audience: cat.target_audience
        }
      }

      await supabase
        .from('system_a_catalog')
        .upsert(catalogItem, { onConflict: 'external_id' })

      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar categoria ${cat.category}:`, err.message)
    }
  }
  return count
}

async function syncProductsCatalog(supabase: any, products: any[]) {
  if (!products || products.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, blocked_reasons: [] }
  }

  const stats = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    blocked_reasons: [] as Array<{product_name: string, reason: string}>
  }

  for (const product of products) {
    // Validar campos obrigatórios
    if (!product || !product.name || !product.slug) {
      console.warn('⚠️ BLOQUEADO: Produto sem name/slug:', product)
      stats.blocked_reasons.push({
        product_name: product?.name || 'DESCONHECIDO',
        reason: 'Faltando name ou slug'
      })
      stats.skipped++
      continue
    }

    // Extrair li_product_id de original_data se disponível
    const liProductId = product.original_data?.li_product_id || product.li_product_id;

    console.log(`📦 Processando produto: "${product.name}"`, {
      id: product.id,
      li_product_id: liProductId,
      has_original_data: !!product.original_data
    });

    // CRÍTICO: li_product_id é obrigatório para mapear com Loja Integrada
    if (!liProductId) {
      console.warn(`⚠️ BLOQUEADO: Produto "${product.name}" sem li_product_id (ID: ${product.id})`)
      stats.blocked_reasons.push({
        product_name: product.name,
        reason: 'Faltando li_product_id (campo obrigatório para Loja Integrada)'
      })
      stats.skipped++
      continue
    }

    // Validar categoria obrigatória (Sistema A)
    if (!product.category) {
      console.warn('⚠️ BLOQUEADO: Produto "${product.name}" sem category')
      stats.blocked_reasons.push({
        product_name: product.name,
        reason: 'Faltando category do Sistema A'
      })
      stats.skipped++
      continue
    }

    try {
      // Garantir mapeamento external_id = li_product_id (ID Loja Integrada)
      const externalId = String(liProductId);
      console.log(`🔑 external_id definido: ${externalId} (fonte: ${product.original_data?.li_product_id ? 'original_data' : 'direto'})`);
      
      // Verificar se produto já existe em system_a_catalog (para estatísticas apenas)
      const { data: existingCatalog } = await supabase
        .from('system_a_catalog')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();

      const isUpdate = !!existingCatalog;

      // Determinar categoria do produto
      let productCategory = 'product'
      if (product.category) {
        const cat = product.category.toLowerCase()
        if (cat.includes('resin') || cat.includes('resina')) productCategory = 'resin'
        else if (cat.includes('printer') || cat.includes('impressora')) productCategory = 'printer'
        else if (cat.includes('acess') || cat.includes('tool')) productCategory = 'accessory'
      }

      const catalogItem = {
        external_id: externalId,
        category: productCategory,
        product_category: product.category,
        product_subcategory: product.subcategory,
        name: product.name,
        slug: product.slug,
        description: product.description,
        image_url: product.image_url,
        price: product.price,
        promo_price: product.promo_price,
        currency: product.currency || 'BRL',
        seo_title_override: product.seo_title_override,
        meta_description: product.seo_description_override,
        canonical_url: product.canonical_url,
        og_image_url: product.image_url,
        keywords: product.keywords || [],
        keyword_ids: product.keyword_ids || [],
        cta_1_label: product.resource_cta1?.label,
        cta_1_url: product.resource_cta1?.url,
        cta_1_description: product.resource_descriptions?.cta1,
        cta_2_label: product.resource_cta2?.label,
        cta_2_url: product.resource_cta2?.url,
        cta_2_description: product.resource_descriptions?.cta2,
        cta_3_label: product.resource_cta3?.label,
        cta_3_url: product.resource_cta3?.url,
        cta_3_description: product.resource_descriptions?.cta3,
        approved: product.approved !== false,
        active: product.active !== false,
        display_order: product.display_order || 0,
        extra_data: {
          sales_pitch: product.sales_pitch,
          benefits: product.benefits,
          features: product.features,
          technical_specifications: product.technical_specifications,
          faq: product.faq,
          variations: product.variations,
          dimensions: {
            weight: product.weight,
            height: product.height,
            width: product.width,
            depth: product.depth
          },
          videos: {
            youtube: product.youtube_videos,
            instagram: product.instagram_videos,
            tiktok: product.tiktok_videos,
            technical: product.technical_videos,
            testimonials: product.testimonial_videos,
            captions: product.video_captions
          },
          content: {
            blog: product.individual_blog_content,
            whatsapp_messages: product.whatsapp_messages,
            whatsapp_sequences: product.whatsapp_sequences,
            youtube_descriptions: product.youtube_descriptions,
            instagram_copies: product.instagram_copies,
            tiktok_content: product.tiktok_content
          },
          google_merchant: {
            ean: product.ean,
            gtin: product.gtin,
            mpn: product.mpn,
            ncm: product.ncm,
            brand: product.brand,
            google_product_category: product.google_product_category,
            condition: product.condition,
            availability: product.availability,
            color: product.color,
            size: product.size,
            material: product.material,
            age_group: product.age_group,
            gender: product.gender
          },
          inventory: {
            stock_quantity: product.stock_quantity,
            stock_managed: product.stock_managed,
            min_order_quantity: product.min_order_quantity,
            max_order_quantity: product.max_order_quantity,
            multiple_order_quantity: product.multiple_order_quantity
          },
          shipping: {
            free_shipping: product.free_shipping,
            shipping_time: product.shipping_time,
            shipping_type: product.shipping_type
          },
          ai_metadata: {
            ai_generated_keywords: product.ai_generated_keywords,
            ai_generated_category: product.ai_generated_category,
            ai_generated_benefits: product.ai_generated_benefits,
            seo_enhanced: product.seo_enhanced,
            bot_trigger_words: product.bot_trigger_words
          },
          sub_entities: {
            cs_messages: product.cs_messages,
            aftersales_messages: product.aftersales_messages,
            coupons: product.coupons,
            google_ads: product.google_ads,
            completion_score: product.completion_score
          },
          images_gallery: product.images_gallery,
          all_categories: product.all_categories,
          tutorial_resources: product.tutorial_resources
        }
      }

      console.log(`${isUpdate ? '🔄 Atualizando' : '🆕 Inserindo'} produto "${product.name}"`, {
        external_id: externalId,
        li_product_id: liProductId,
        slug: product.slug,
        category: product.category,
        subcategory: product.subcategory
      });

      const { error: upsertError } = await supabase
        .from('system_a_catalog')
        .upsert(catalogItem, { onConflict: 'external_id' });

      if (upsertError) {
        console.error(`❌ Erro ao sincronizar produto ${product.name}:`, upsertError.message);
        stats.blocked_reasons.push({
          product_name: product.name,
          reason: `Erro de banco: ${upsertError.message}`
        })
        stats.skipped++
        continue;
      }

      if (isUpdate) {
        console.log(`🔄 Produto "${product.name}" (${externalId}) ATUALIZADO`);
        stats.updated++
      } else {
        console.log(`✅ Produto "${product.name}" (${externalId}) INSERIDO`);
        stats.inserted++
      }
    } catch (err: any) {
      console.error(`❌ Exceção ao processar produto ${product.name}:`, err)
      stats.blocked_reasons.push({
        product_name: product.name,
        reason: `Exceção: ${err.message}`
      })
      stats.skipped++
    }
  }
  
  return stats
}

async function syncVideoTestimonials(supabase: any, testimonials: any[]) {
  if (!testimonials || testimonials.length === 0) return 0

  let count = 0
  for (const testimonial of testimonials) {
    try {
      const catalogItem = {
        external_id: `testimonial_${testimonial.id}`,
        category: 'video_testimonial',
        name: testimonial.client_name,
        description: testimonial.testimonial_text,
        image_url: testimonial.youtube_url ? `https://img.youtube.com/vi/${testimonial.youtube_url.split('v=')[1]}/maxresdefault.jpg` : null,
        rating: testimonial.sentiment_score ? (testimonial.sentiment_score * 5) : null,
        approved: testimonial.approved !== false,
        display_order: testimonial.display_order || 0,
        extra_data: {
          client: {
            profession: testimonial.profession,
            specialty: testimonial.specialty,
            location: testimonial.location,
            state: testimonial.state
          },
          media: {
            youtube_url: testimonial.youtube_url,
            instagram_url: testimonial.instagram_url
          },
          ai_analysis: {
            caption_data: testimonial.caption_data,
            keywords: testimonial.ai_keywords,
            extracted_benefits: testimonial.ai_extracted_benefits,
            sentiment_score: testimonial.sentiment_score
          },
          landing_page_id: testimonial.landing_page_id
        }
      }

      await supabase
        .from('system_a_catalog')
        .upsert(catalogItem, { onConflict: 'external_id' })

      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar depoimento ${testimonial.client_name}:`, err.message)
    }
  }
  return count
}

async function syncGoogleReviews(supabase: any, reviews: any[]) {
  if (!reviews || reviews.length === 0) return 0

  let count = 0
  for (const review of reviews) {
    try {
      const catalogItem = {
        external_id: `review_${review.place_id}_${review.author_name.replace(/\s+/g, '_')}`,
        category: 'google_review',
        name: review.author_name,
        description: review.review_text,
        image_url: review.profile_photo_url,
        rating: review.rating,
        approved: review.approved !== false,
        display_order: review.display_order || 0,
        extra_data: {
          google_data: {
            place_id: review.place_id,
            author_url: review.author_url,
            review_date: review.review_date,
            relative_time: review.relative_time,
            is_local_guide: review.is_local_guide,
            review_likes: review.review_likes
          },
          response: {
            response_from_owner: review.response_from_owner,
            response_date: review.response_date
          },
          seo_enrichment: {
            contextual_info: review.contextual_seo_info,
            ai_keywords: review.ai_keywords,
            generated_by_ai: review.seo_generated_by_ai
          },
          landing_page_id: review.landing_page_id,
          approved_by: review.approved_by,
          notes: review.notes,
          extracted_at: review.extracted_at
        }
      }

      await supabase
        .from('system_a_catalog')
        .upsert(catalogItem, { onConflict: 'external_id' })

      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar review de ${review.author_name}:`, err.message)
    }
  }
  return count
}

async function syncKOLs(supabase: any, kols: any[]) {
  if (!kols || kols.length === 0) return 0

  let count = 0
  for (const kol of kols) {
    try {
      const catalogItem = {
        external_id: `kol_${kol.id || kol.full_name.replace(/\s+/g, '_')}`,
        category: 'kol',
        name: kol.full_name,
        description: kol.mini_cv,
        image_url: kol.photo_url,
        approved: kol.approved !== false,
        display_order: kol.display_order || 0,
        extra_data: {
          specialty: kol.specialty,
          links: {
            lattes: kol.lattes_url,
            website: kol.website_url,
            instagram: kol.instagram_url,
            youtube: kol.youtube_url
          }
        }
      }

      await supabase
        .from('system_a_catalog')
        .upsert(catalogItem, { onConflict: 'external_id' })

      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar KOL ${kol.full_name}:`, err.message)
    }
  }
  return count
}
