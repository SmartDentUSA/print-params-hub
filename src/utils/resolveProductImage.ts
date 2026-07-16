export type ProductImageInput = {
  image_background_removed_url?: string | null
  image_urls?: string[] | null
  image_url?: string | null
}

/**
 * Ordem de preferência da imagem oficial (spec Smart Dent):
 * 1) image_background_removed_url
 * 2) primeira válida em image_urls
 * 3) image_url
 * 4) null → chamador exibe erro MISSING_OFFICIAL_PRODUCT_IMAGE
 */
export function resolveProductImage(product: ProductImageInput | null | undefined): string | null {
  if (!product) return null
  if (product.image_background_removed_url && product.image_background_removed_url.trim()) {
    return product.image_background_removed_url
  }
  if (Array.isArray(product.image_urls)) {
    const first = product.image_urls.find((u) => typeof u === 'string' && u.trim().length > 0)
    if (first) return first
  }
  if (product.image_url && product.image_url.trim()) return product.image_url
  return null
}

export const SMART_DENT_LOGO_URL =
  'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png'