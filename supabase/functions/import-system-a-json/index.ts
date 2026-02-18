import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para sanitizar nome do produto para usar como nome de arquivo
function sanitizeFileName(productName: string): string {
  return productName
    .normalize('NFD')                    // Remove acentos
    .replace(/[\u0300-\u036f]/g, '')    
    .replace(/[^\w\s-]/g, '')           // Remove especiais (®, ©, etc)
    .replace(/\s+/g, '-')               // Espaços → hífens
    .replace(/-+/g, '-')                // Remove hífens duplicados
    .replace(/^-+|-+$/g, '')            // Remove hífens nas pontas
    .substring(0, 100)                  // Limita a 100 caracteres
    .trim();
}

// Função para upload automático de imagem externa para Supabase Storage
async function uploadImageToStorage(
  imageUrl: string,
  productName: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    // 1. Baixar imagem
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.status}`);
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    // 2. Preparar nome baseado no produto
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const baseName = sanitizeFileName(productName);
    let fileName = `${baseName}.${ext}`;
    let filePath = `products/${fileName}`;
    
    // 3. Verificar se arquivo já existe e adicionar sufixo se necessário
    let counter = 1;
    while (counter < 100) { // Limite de segurança
      const { data: existingFiles } = await supabaseAdmin.storage
        .from('catalog-images')
        .list('products', {
          search: fileName
        });
      
      if (!existingFiles || existingFiles.length === 0) break;
      
      fileName = `${baseName}-${counter}.${ext}`;
      filePath = `products/${fileName}`;
      counter++;
    }
    
    // 4. Upload
    const { error: uploadError } = await supabaseAdmin.storage
      .from('catalog-images')
      .upload(filePath, arrayBuffer, {
        contentType: blob.type,
        cacheControl: '31536000', // 1 ano
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    // 5. Retornar URL pública
    const { data } = supabaseAdmin.storage
      .from('catalog-images')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  } catch (error) {
    console.error(`❌ Erro ao fazer upload da imagem "${productName}":`, error);
    return imageUrl; // Fallback para URL original
  }
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
  product_category?: string
  product_subcategory?: string
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

// ===== DYNAMIC PRODUCT + RESIN FETCHING =====
async function fetchProductsForLinking(supabase: any) {
  console.log('🔍 Fetching products and resins from database for auto-linking...')
  
  // Fetch products from system_a_catalog
  const { data: products, error: prodError } = await supabase
    .from('system_a_catalog')
    .select('name, cta_1_url, slug, keywords, category')
    .in('category', ['product', 'resin'])
    .eq('active', true)
    .eq('approved', true)
  
  if (prodError) {
    console.error('❌ Error fetching products:', prodError)
  }
  
  // Fetch resins from dedicated resins table
  const { data: resins, error: resinError } = await supabase
    .from('resins')
    .select('name, manufacturer, slug, cta_1_url, system_a_product_url, keywords')
    .eq('active', true)
  
  if (resinError) {
    console.error('❌ Error fetching resins:', resinError)
  }
  
  // Combine both sources
  const allItems = [
    ...(products || []),
    ...(resins || []).map(r => ({
      name: r.name,
      cta_1_url: r.cta_1_url,
      slug: r.slug,
      keywords: r.keywords,
      category: 'resin',
      system_a_product_url: r.system_a_product_url
    }))
  ]
  
  console.log(`✅ Loaded ${products?.length || 0} products + ${resins?.length || 0} resins = ${allItems.length} items for auto-linking`)
  return allItems
}

// Build product/resin URL from multiple possible fields
function buildProductUrl(item: any): string | null {
  // Priority 1: Use system_a_product_url (for resins from resins table)
  if (item.system_a_product_url && item.system_a_product_url.includes('loja.smartdent.com.br')) {
    return item.system_a_product_url
  }
  
  // Priority 2: Use cta_1_url if exists and valid
  if (item.cta_1_url && item.cta_1_url.includes('loja.smartdent.com.br')) {
    return item.cta_1_url
  }
  
  // Priority 3: If slug is already a full URL, use it
  if (item.slug && item.slug.includes('http')) {
    // But skip admin URLs
    if (item.slug.includes('app.lojaintegrada.com.br/painel')) {
      return null
    }
    return item.slug
  }
  
  // Priority 4: Build URL from slug
  if (item.slug) {
    return `https://loja.smartdent.com.br/${item.slug}`
  }
  
  return null
}

// Build search index with smart name variations
function buildSearchIndex(items: any[]) {
  const index: Array<{
    keywords: string[]
    url: string
    priority: number
    itemName: string
    itemType: string
  }> = []
  
  items.forEach(item => {
    const url = buildProductUrl(item)
    if (!url) {
      console.log(`⚠️ Skipping ${item.name} - no valid URL`)
      return
    }
    
    // Build keyword list
    const keywords: string[] = []
    
    // Add existing keywords (if any)
    if (item.keywords && Array.isArray(item.keywords) && item.keywords.length > 0) {
      keywords.push(...item.keywords.map((k: string) => k.toLowerCase().trim()))
    }
    
    // Add product/resin name variations
    const name = item.name.toLowerCase()
    keywords.push(name)
    
    // For resins, add smart variations
    if (item.category === 'resin') {
      // Remove "Resina 3D" prefix
      const withoutPrefix = name.replace(/^resina 3d\s+/i, '').trim()
      if (withoutPrefix !== name) {
        keywords.push(withoutPrefix)
      }
      
      // Remove "Smart Print" to get core name
      const withoutBrand = withoutPrefix.replace(/smart print\s+/i, '').trim()
      if (withoutBrand !== withoutPrefix) {
        keywords.push(withoutBrand)
      }
      
      // Extract key terms (e.g., "Bio Denture", "Model Precision")
      const keyTerms = withoutBrand.match(/\b(?:bio|model|clear|hybrid)\s+\w+/gi)
      if (keyTerms) {
        keywords.push(...keyTerms.map(t => t.toLowerCase().trim()))
      }
    }
    
    // Add common variations (remove special chars, extra spaces)
    const cleanName = name
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleanName !== name) {
      keywords.push(cleanName)
    }
    
    // Calculate priority: items with keywords get higher priority
    const priority = item.keywords?.length > 0 ? 10 : 5
    
    index.push({
      keywords: [...new Set(keywords)], // Remove duplicates
      url,
      priority,
      itemName: item.name,
      itemType: item.category || 'product'
    })
    
    console.log(`📦 Indexed: ${item.name} (${item.category || 'product'}) | ${keywords.length} keywords | priority ${priority}`)
  })
  
  // Sort by priority (higher first)
  return index.sort((a, b) => b.priority - a.priority)
}

// ===== SMART AUTO-LINKING (Most relevant only) =====
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addSmartLinks(text: string, searchIndex: any[]): { linkedText: string; itemsMentioned: Array<{name: string, type: string}> } {
  let linkedText = text
  const itemsMentioned: Array<{name: string, type: string}> = []
  
  // Build matches with positions to select most relevant
  const matches: Array<{
    keyword: string
    url: string
    priority: number
    position: number
    itemName: string
    itemType: string
  }> = []
  
  // Find all potential matches
  searchIndex.forEach(item => {
    item.keywords.forEach((keyword: string) => {
      // Skip very short keywords (< 4 chars) to avoid false positives
      if (keyword.length < 4) return
      // Skip template placeholder keywords like "[nome do produto]"
      if (keyword.includes('[') || keyword.includes(']')) return
      
      // Try exact match
      const regexExact = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi')
      let match
      while ((match = regexExact.exec(text)) !== null) {
        matches.push({
          keyword,
          url: item.url,
          priority: item.priority,
          position: match.index,
          itemName: item.itemName,
          itemType: item.itemType
        })
      }
    })
  })
  
  // Sort by priority (highest first), then by position (earliest first)
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.position - b.position
  })
  
  // Link only the MOST relevant mention (first after sorting)
  if (matches.length > 0) {
    const best = matches[0]
    const regex = new RegExp(`\\b(${escapeRegex(best.keyword)})\\b`, 'i')
    linkedText = linkedText.replace(
      regex,
      `<a href="${best.url}" class="text-primary hover:underline font-medium" target="_blank" rel="noopener">$1</a>`
    )
    itemsMentioned.push({
      name: best.itemName,
      type: best.itemType
    })
    console.log(`🔗 Linked "${best.keyword}" → ${best.itemName} (${best.itemType})`)
  }
  
  return { linkedText, itemsMentioned }
}

// ===== DATA CLEANING FUNCTIONS =====
// Generate random video duration (30-35 seconds)
function generateVideoDuration(): number {
  return Math.floor(Math.random() * 6) + 30 // 30-35 seconds
}

// Extract real client name from text or use placeholder
function extractClientName(clientName: string, testimonialText: string): string {
  // If already has real name (not "Cliente #X"), keep it
  if (clientName && !clientName.match(/^Cliente #\d+$/)) {
    return clientName
  }
  
  // Try to extract from pattern "🦷 Dra. Nome Sobrenome"
  const nameMatch = testimonialText.match(/🦷\s*(Dr[a]?\.\s+[A-Z][a-zÀ-ú]+(?:\s+[A-Z][a-zÀ-ú]+)*)/i)
  if (nameMatch) {
    return nameMatch[1].trim()
  }
  
  // Fallback: use first 50 chars of text as identifier
  return testimonialText.substring(0, 50).trim() + '...'
}

// Clean video URL (remove placeholders, validate)
function cleanVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  
  // Remove common placeholders
  const placeholders = [
    'MUITO GRANDE PARA POSTAR',
    'Link do vídeo YOUTUBE',
    'Link do vídeo INSTAGRAM',
    'N/A',
    'null',
    'undefined'
  ]
  
  for (const placeholder of placeholders) {
    if (url.includes(placeholder)) {
      return null
    }
  }
  
  // Validate URL format
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null
  }
  
  return url
}

// Validate testimonial text
function isValidTestimonial(testimonial: any): boolean {
  if (!testimonial.testimonial_text) return false
  
  const text = testimonial.testimonial_text.trim()
  
  // Must have at least 20 characters
  if (text.length < 20) return false
  
  // Reject obvious placeholders
  const invalidPatterns = [
    /^Link do vídeo/i,
    /^MUITO GRANDE/i,
    /^N\/A$/i,
    /^null$/i,
    /^undefined$/i
  ]
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(text)) {
      return false
    }
  }
  
  // Reject if only punctuation/whitespace
  if (text.replace(/[\s.,!?;:]+/g, '').length === 0) {
    return false
  }
  
  return true
}

// Map products to catalog items
async function mapProducts(products: any[], supabaseAdmin: any): Promise<CatalogItem[]> {
  if (!products || !Array.isArray(products)) return []
  
  const mapped: CatalogItem[] = []
  
  for (const p of products) {
    const product = p.product || p
    
    // Use original image URL directly (no upload to avoid timeout with many products)
    const finalImageUrl = product.image_url || null
    
    mapped.push({
      source: 'system_a',
      category: 'product',
      external_id: String(product.id),
      name: product.name,
      slug: product.slug,
      product_category: product.category,
      product_subcategory: product.subcategory,
      description: product.description,
      image_url: finalImageUrl,
      price: product.price ? parseFloat(product.price) : undefined,
      promo_price: product.promo_price
        ? parseFloat(product.promo_price)
        : (product.original_price ? parseFloat(product.original_price) : undefined),
      currency: 'BRL',
      keywords: [
        ...(Array.isArray(product.keywords) ? product.keywords : []),
        ...(Array.isArray(product.market_keywords) ? product.market_keywords : [])
      ],
      seo_title_override: product.seo_title_override,
      meta_description: product.seo_description_override,
      canonical_url: product.canonical_url || product.product_url || undefined,
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
        specifications: product.specifications || product.technical_specifications,
        category: product.category,
        subcategory: product.subcategory,
        // Campos ricos do llm_optimized format
        sales_pitch: product.sales_pitch,
        applications: product.applications,
        anti_hallucination: product.anti_hallucination,
        // CORRIGIDO: required_products e forbidden_products estão dentro de anti_hallucination
        required_products: product.anti_hallucination?.required_products,
        forbidden_products: product.anti_hallucination?.forbidden_products,
        faq: product.faq,
        market_keywords: product.market_keywords,
        target_audience: product.target_audience,
        brand: product.brand,
        mpn: product.mpn,
        product_url: product.product_url
      }
    })
  }
  
  return mapped
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

// Normalize product/equipment terms for SEO consistency
function normalizeTerms(text: string | null | undefined): string {
  if (!text) return ''
  
  let normalized = text
  
  // Rule 1: BLZ Scanner variations → "Scanner intraoral BLZ INO200"
  normalized = normalized.replace(/\bBLZ Scanner\b/gi, 'Scanner intraoral BLZ INO200')
  normalized = normalized.replace(/\bBLZ\b(?! INO200)/gi, 'Scanner intraoral BLZ INO200')
  
  // Rule 2: Medit → "Scanner intraoral Medit"
  normalized = normalized.replace(/\bMedit\b(?! Scanner)/gi, 'Scanner intraoral Medit')
  
  // Rule 3: Generic printer → "Impressora RayShape Edge mini"
  normalized = normalized.replace(/\bImpressora\b(?! RayShape)/gi, 'Impressora RayShape Edge mini')
  
  // Rule 4: Smartdent → "Smart Dent" (with space)
  normalized = normalized.replace(/\bSmartdent\b/gi, 'Smart Dent')
  normalized = normalized.replace(/\bSmartDent\b/gi, 'Smart Dent')
  
  return normalized
}

// Add institutional footer about Smart Dent complete solution
function addResinFooter(testimonialText: string): string {
  if (!testimonialText) return ''
  
  // Avoid duplication
  if (testimonialText.includes('solução completa')) {
    return testimonialText
  }
  
  const footer = '\n\nA Smart Dent oferece uma solução completa do escaneamento à impressão, incluindo Resina Smart Dent Bio Vitality e Resina Smart Dent Bite Splint +Flex, para fluxos digitais completos em odontologia.'
  
  return testimonialText + footer
}

// Generate SEO-optimized meta description
function generateMetaDescription(name: string, description: string): string {
  const maxLength = 155
  
  // Extract first sentence or truncate
  let meta = description.split('\n\n')[0] || description
  meta = meta.replace(/\n/g, ' ').trim()
  
  if (meta.length > maxLength) {
    meta = meta.substring(0, maxLength - 3) + '...'
  }
  
  return `${name} compartilha experiência com Smart Dent. ${meta}`
}

// Map video testimonials to catalog items with smart linking and data cleaning
function mapVideoTestimonials(videos: any[], searchIndex: any[]): CatalogItem[] {
  if (!videos || !Array.isArray(videos)) return []
  
  console.log(`🎬 Processing ${videos.length} video testimonials...`)
  console.log(`📚 Using search index with ${searchIndex.length} items`)
  
  // PHASE 1: Filter valid testimonials
  const validTestimonials = videos.filter(v => {
    const isValid = isValidTestimonial(v)
    if (!isValid) {
      console.log(`⚠️ Filtered invalid: ${v.id} (${v.testimonial_text?.substring(0, 50)})`)
    }
    return isValid
  })
  console.log(`✅ ${validTestimonials.length} valid testimonials (filtered ${videos.length - validTestimonials.length})`)
  
  // PHASE 2: Detect duplicates using first 100 chars as signature
  const seenSignatures = new Set<string>()
  const uniqueTestimonials = validTestimonials.filter(v => {
    const signature = v.testimonial_text.substring(0, 100).trim().toLowerCase()
    if (seenSignatures.has(signature)) {
      console.log(`🔄 Filtered duplicate: ${v.id} (duplicate of ${signature.substring(0, 30)})`)
      return false
    }
    seenSignatures.add(signature)
    return true
  })
  console.log(`✅ ${uniqueTestimonials.length} unique testimonials (removed ${validTestimonials.length - uniqueTestimonials.length} duplicates)`)
  
  // PHASE 3: Process each testimonial
  return uniqueTestimonials.map(v => {
    // Step 1: Extract real client name
    const extractedName = extractClientName(v.client_name, v.testimonial_text)
    
    // Step 2: Normalize product terms
    const normalizedName = normalizeTerms(extractedName)
    const normalizedText = normalizeTerms(v.testimonial_text)
    
    // Step 3: Apply smart linking
    const { linkedText, itemsMentioned } = addSmartLinks(normalizedText, searchIndex)
    
    // Step 4: Add institutional footer
    const finalDescription = addResinFooter(linkedText)
    
    // Step 5: Generate SEO meta
    const seoTitle = `${normalizedName} | Depoimento Smart Dent`
    const metaDescription = generateMetaDescription(normalizedName, finalDescription)
    
    // Step 6: Clean video URLs
    const cleanedYoutubeUrl = cleanVideoUrl(v.youtube_url)
    const cleanedInstagramUrl = cleanVideoUrl(v.instagram_url)
    
    // Step 7: Generate video duration if missing
    const videoDuration = v.video_duration_seconds || generateVideoDuration()
    
    console.log(`✨ Processed: ${normalizedName.substring(0, 50)}... | Duration: ${videoDuration}s | Links: ${itemsMentioned.length}`)
    
    return {
      source: 'system_a',
      category: 'video_testimonial',
      external_id: String(v.id),
      name: normalizedName,
      description: finalDescription,
      display_order: v.display_order || 0,
      approved: v.approved !== false,
      active: true,
      visible_in_ui: false,
      
      // SEO optimization
      seo_title_override: seoTitle,
      meta_description: metaDescription,
      
      extra_data: {
        youtube_url: cleanedYoutubeUrl,
        instagram_url: cleanedInstagramUrl,
        location: v.location,
        specialty: v.specialty,
        profession: v.profession,
        video_thumbnail: v.video_thumbnail,
        video_transcript: v.video_transcript || null,
        video_duration_seconds: videoDuration,
        original_client_name: v.client_name,
        auto_enriched: true,
        items_mentioned: itemsMentioned,
        processing_timestamp: new Date().toISOString()
      }
    }
  })
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

    // ⭐ NORMALIZE NEW SCHEMA: { meta, data: { company, products, ... } }
    // Old schema used: data.company_profile, data.categories_config, data.video_testimonials, data.google_reviews
    // New schema uses: data.company, data.products, data.categories, data.testimonials, data.reviews, data.kols
    const rawData = jsonData.data || jsonData
    const data: Record<string, any> = {
      // Normalize company: new schema uses "company", old uses "company_profile"
      company_profile: rawData.company_profile || rawData.company || null,
      // Products: same key in both schemas
      products: rawData.products || null,
      // Categories: new uses "categories", old uses "categories_config"
      categories_config: rawData.categories_config || rawData.categories || null,
      // Testimonials: new uses "testimonials", old uses "video_testimonials"
      video_testimonials: rawData.video_testimonials || rawData.testimonials || null,
      // Reviews: new uses "reviews", old uses "google_reviews"
      google_reviews: rawData.google_reviews || rawData.reviews || null,
      // KOLs: same key in both schemas
      kols: rawData.kols || null,
    }

    console.log('📊 Normalized schema detection:', {
      hasProducts: !!data.products,
      hasCompanyProfile: !!data.company_profile,
      hasCategoriesConfig: !!data.categories_config,
      hasVideoTestimonials: !!data.video_testimonials,
      hasGoogleReviews: !!data.google_reviews,
      hasKOLs: !!data.kols,
      schemaVersion: rawData.company ? 'new (apostila)' : 'old (legacy)'
    })

    // ⭐ FETCH products/resins for auto-linking BEFORE processing data
    const items = await fetchProductsForLinking(supabase)
    const searchIndex = buildSearchIndex(items)

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
      const products = await mapProducts(data.products, supabase)
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

    // Map video testimonials with smart linking
    if (data.video_testimonials) {
      const videos = mapVideoTestimonials(data.video_testimonials, searchIndex)
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

    // Batch upsert in chunks of 50 to avoid payload size limits
    if (allCatalogItems.length > 0) {
      const UPSERT_BATCH = 50
      for (let i = 0; i < allCatalogItems.length; i += UPSERT_BATCH) {
        // Sanitize extra_data to strip undefined values (invalid JSON for PostgreSQL jsonb)
        const batch = allCatalogItems.slice(i, i + UPSERT_BATCH).map(item => ({
          ...item,
          extra_data: item.extra_data
            ? JSON.parse(JSON.stringify(item.extra_data))
            : null
        }))
        const { error: upsertError } = await supabase
          .from('system_a_catalog')
          .upsert(batch, {
            onConflict: 'source,external_id',
            ignoreDuplicates: false
          })

        if (upsertError) {
          console.error('❌ Upsert error:', upsertError)
          stats.errors++
          throw upsertError
        }

        console.log(`✅ Upsert batch ${Math.floor(i / UPSERT_BATCH) + 1}/${Math.ceil(allCatalogItems.length / UPSERT_BATCH)} completed`)
      }
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
