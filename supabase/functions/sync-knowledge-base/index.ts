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

    console.log('🔄 Iniciando sincronização da Knowledge Base...')

    // 1. Buscar dados da Knowledge Base API (Sistema A)
    const kbData = await fetchKnowledgeBaseAPI()

    // 2. Sincronizar external_links
    const linksCount = await syncExternalLinks(supabaseClient, kbData.links || [])

    // 3. Sincronizar resins com keyword_ids
    const resinsCount = await syncResins(supabaseClient, kbData.products || [])

    console.log(`✅ Sincronização concluída: ${linksCount} keywords, ${resinsCount} resinas`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sincronização concluída',
        stats: {
          keywords: linksCount,
          resins: resinsCount
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
  apiUrl.searchParams.append('format', 'system_b')
  apiUrl.searchParams.append('include_company', 'false')
  apiUrl.searchParams.append('include_categories', 'false')
  apiUrl.searchParams.append('include_links', 'true')
  apiUrl.searchParams.append('include_products', 'true')
  apiUrl.searchParams.append('approved_only', 'true')

  console.log('📡 Buscando dados da API:', apiUrl.toString())

  const response = await fetch(apiUrl.toString())
  
  if (!response.ok) {
    throw new Error(`API retornou status ${response.status}`)
  }

  return await response.json()
}

async function syncExternalLinks(supabase: any, links: any[]) {
  if (!links || links.length === 0) {
    console.log('⚠️ Nenhuma keyword para sincronizar')
    return 0
  }

  console.log(`🔄 Sincronizando ${links.length} keywords...`)
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
        console.log(`✅ Keyword atualizada: ${link.name}`)
      } else {
        // INSERT
        await supabase
          .from('external_links')
          .insert({
            id: link.id,
            ...linkData,
            usage_count: 0,
          })
        console.log(`➕ Keyword inserida: ${link.name}`)
      }
      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar keyword "${link.name}":`, err.message)
    }
  }

  return count
}

async function syncResins(supabase: any, products: any[]) {
  if (!products || products.length === 0) {
    console.log('⚠️ Nenhum produto para sincronizar')
    return 0
  }

  console.log(`🔄 Sincronizando ${products.length} produtos (resinas)...`)
  let count = 0

  for (const item of products) {
    const product = item.product || item

    try {
      // Verificar se resina já existe pelo slug
      const { data: existing } = await supabase
        .from('resins')
        .select('id')
        .eq('slug', product.slug)
        .single()

      const resinData = {
        name: product.name,
        manufacturer: product.manufacturer || product.brand || 'Desconhecido',
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        slug: product.slug,
        seo_title_override: product.seo_title_override,
        meta_description: product.seo_description_override,
        og_image_url: product.image_url,
        canonical_url: product.canonical_url,
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
      }

      if (existing) {
        await supabase
          .from('resins')
          .update(resinData)
          .eq('id', existing.id)
        console.log(`✅ Resina atualizada: ${product.name}`)
      } else {
        await supabase
          .from('resins')
          .insert(resinData)
        console.log(`➕ Resina inserida: ${product.name}`)
      }
      count++
    } catch (err) {
      console.error(`❌ Erro ao sincronizar resina "${product.name}":`, err.message)
    }
  }

  return count
}
