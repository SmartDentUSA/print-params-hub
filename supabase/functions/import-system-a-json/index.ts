import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CatalogItem {
  source: string
  category: string
  external_id: string
  name: string
  slug?: string
  description?: string
  image_url?: string
  price?: number
  promo_price?: number
  currency?: string
  keywords?: string[]
  seo_title_override?: string
  meta_description?: string
  canonical_url?: string
  og_image_url?: string
  cta_1_label?: string
  cta_1_url?: string
  cta_1_description?: string
  cta_2_label?: string
  cta_2_url?: string
  cta_2_description?: string
  cta_3_label?: string
  cta_3_url?: string
  cta_3_description?: string
  approved?: boolean
  active?: boolean
  visible_in_ui?: boolean
  display_order?: number
  rating?: number
  review_count?: number
  extra_data?: any
}

// Map products to catalog items
function mapProducts(products: any[]): CatalogItem[] {
  if (!products || !Array.isArray(products)) return []
  
  return products.map(p => {
    const product = p.product || p
    return {
      source: 'system_a',
      category: 'product',
      external_id: String(product.id),
      name: product.name,
      slug: product.slug,
      description: product.description,
      image_url: product.image_url,
      price: product.price ? parseFloat(product.price) : undefined,
      promo_price: product.promo_price ? parseFloat(product.promo_price) : undefined,
      currency: 'BRL',
      keywords: Array.isArray(product.keywords) ? product.keywords : [],
      seo_title_override: product.seo_title_override,
      meta_description: product.seo_description_override,
      canonical_url: product.canonical_url,
      og_image_url: product.og_image_url,
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
      visible_in_ui: false,
      extra_data: {
        variations: product.variations,
        benefits: product.benefits,
        features: product.features,
        images_gallery: product.images_gallery,
        coupons: p.coupons,
        specifications: product.specifications,
        category: product.category,
        subcategory: product.subcategory
      }
    }
  })
}

// Map company profile to catalog item
function mapCompanyProfile(company: any): CatalogItem | null {
  if (!company) return null
  
  return {
    source: 'system_a',
    category: 'company_info',
    external_id: String(company.id || 'company-1'),
    name: company.company_name,
    description: company.company_description,
    approved: true,
    active: true,
    visible_in_ui: false,
    extra_data: {
      contact_email: company.contact_email,
      contact_phone: company.contact_phone,
      whatsapp: company.whatsapp,
      instagram: company.instagram_profile,
      youtube: company.youtube_channel,
      facebook: company.facebook,
      linkedin: company.linkedin,
      target_audience: company.target_audience,
      seo_domains: company.seo_domains,
      reviews: company.company_reviews
    }
  }
}

// Map categories config to catalog items
function mapCategoriesConfig(categories: any[]): CatalogItem[] {
  if (!categories || !Array.isArray(categories)) return []
  
  return categories.map(c => ({
    source: 'system_a',
    category: 'category_config',
    external_id: String(c.id),
    name: `${c.category} - ${c.subcategory}`,
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
    approved: true,
    active: true,
    visible_in_ui: false,
    extra_data: {
      category: c.category,
      subcategory: c.subcategory,
      target_audience: c.target_audience
    }
  }))
}

// Map video testimonials to catalog items
function mapVideoTestimonials(videos: any[]): CatalogItem[] {
  if (!videos || !Array.isArray(videos)) return []
  
  return videos.map(v => ({
    source: 'system_a',
    category: 'video_testimonial',
    external_id: String(v.id),
    name: v.client_name,
    description: v.testimonial_text,
    display_order: v.display_order || 0,
    approved: v.approved !== false,
    active: true,
    visible_in_ui: false,
    extra_data: {
      youtube_url: v.youtube_url,
      instagram_url: v.instagram_url,
      location: v.location,
      specialty: v.specialty,
      profession: v.profession,
      video_thumbnail: v.video_thumbnail
    }
  }))
}

// Map Google reviews to catalog items
function mapGoogleReviews(reviews: any[]): CatalogItem[] {
  if (!reviews || !Array.isArray(reviews)) return []
  
  return reviews.map(r => ({
    source: 'system_a',
    category: 'google_review',
    external_id: String(r.id || r.review_id),
    name: r.reviewer_name,
    description: r.review_text,
    rating: r.rating ? parseFloat(r.rating) : undefined,
    display_order: r.display_order || 0,
    approved: r.approved !== false,
    active: true,
    visible_in_ui: false,
    extra_data: {
      review_date: r.review_date,
      google_profile_url: r.google_profile_url
    }
  }))
}

// Map KOLs to catalog items
function mapKOLs(kols: any[]): CatalogItem[] {
  if (!kols || !Array.isArray(kols)) return []
  
  return kols.map(k => ({
    source: 'system_a',
    category: 'kol',
    external_id: String(k.id),
    name: k.name,
    description: k.bio,
    image_url: k.photo_url,
    approved: k.approved !== false,
    active: true,
    visible_in_ui: false,
    extra_data: {
      specialty: k.specialty,
      instagram: k.instagram,
      youtube: k.youtube,
      linkedin: k.linkedin,
      credentials: k.credentials
    }
  }))
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📥 Import System A JSON - Request received')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const jsonData = await req.json()
    console.log('📊 JSON Data structure:', {
      hasData: !!jsonData.data,
      hasProducts: !!jsonData.data?.products,
      hasCompanyProfile: !!jsonData.data?.company_profile,
      hasCategoriesConfig: !!jsonData.data?.categories_config,
      hasVideoTestimonials: !!jsonData.data?.video_testimonials,
      hasGoogleReviews: !!jsonData.data?.google_reviews,
      hasKOLs: !!jsonData.data?.kols
    })

    const data = jsonData.data || jsonData

    // Collect all catalog items
    const allCatalogItems: CatalogItem[] = []
    const stats = {
      products: 0,
      company_info: 0,
      category_config: 0,
      video_testimonial: 0,
      google_review: 0,
      kol: 0,
      errors: 0
    }

    // Map products
    if (data.products) {
      const products = mapProducts(data.products)
      allCatalogItems.push(...products)
      stats.products = products.length
      console.log(`✅ Mapped ${products.length} products`)
    }

    // Map company profile
    if (data.company_profile) {
      const company = mapCompanyProfile(data.company_profile)
      if (company) {
        allCatalogItems.push(company)
        stats.company_info = 1
        console.log('✅ Mapped company profile')
      }
    }

    // Map categories config
    if (data.categories_config) {
      const categories = mapCategoriesConfig(data.categories_config)
      allCatalogItems.push(...categories)
      stats.category_config = categories.length
      console.log(`✅ Mapped ${categories.length} category configs`)
    }

    // Map video testimonials
    if (data.video_testimonials) {
      const videos = mapVideoTestimonials(data.video_testimonials)
      allCatalogItems.push(...videos)
      stats.video_testimonial = videos.length
      console.log(`✅ Mapped ${videos.length} video testimonials`)
    }

    // Map Google reviews
    if (data.google_reviews) {
      const reviews = mapGoogleReviews(data.google_reviews)
      allCatalogItems.push(...reviews)
      stats.google_review = reviews.length
      console.log(`✅ Mapped ${reviews.length} Google reviews`)
    }

    // Map KOLs
    if (data.kols) {
      const kols = mapKOLs(data.kols)
      allCatalogItems.push(...kols)
      stats.kol = kols.length
      console.log(`✅ Mapped ${kols.length} KOLs`)
    }

    console.log(`📦 Total catalog items to upsert: ${allCatalogItems.length}`)

    // Batch upsert all items
    if (allCatalogItems.length > 0) {
      const { error: upsertError } = await supabase
        .from('system_a_catalog')
        .upsert(allCatalogItems, {
          onConflict: 'source,external_id',
          ignoreDuplicates: false
        })

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError)
        stats.errors++
        throw upsertError
      }

      console.log('✅ Batch upsert completed successfully')
    }

    // Calculate total
    const total = stats.products + stats.company_info + stats.category_config + 
                  stats.video_testimonial + stats.google_review + stats.kol

    const response = {
      success: true,
      message: `Successfully imported ${total} items from System A`,
      stats: {
        ...stats,
        total
      },
      timestamp: new Date().toISOString()
    }

    console.log('📊 Final stats:', response.stats)

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Import error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
