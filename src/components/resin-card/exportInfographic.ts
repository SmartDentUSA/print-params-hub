import { toPng } from 'html-to-image'
import { supabase } from '@/integrations/supabase/client'
import { extensionFromMime } from '@/utils/storageImage'

export type AssetValidation = {
  logoLoaded: boolean
  productImageLoaded: boolean
  productImageSource: string | null
  fontLoaded: boolean
  errors: string[]
}

async function waitForImage(img: HTMLImageElement): Promise<boolean> {
  try {
    if (img.complete && img.naturalWidth > 0) {
      await img.decode().catch(() => undefined)
      return true
    }
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Falha ao carregar: ${img.src}`))
    })
    await img.decode().catch(() => undefined)
    return true
  } catch {
    return false
  }
}

async function ensureFontReady(): Promise<boolean> {
  try {
    await document.fonts.ready
    // check by iterating that at least one Host Grotesk face reports loaded
    let hostLoaded = false
    document.fonts.forEach((f) => {
      if (/Host Grotesk/i.test(f.family) && f.status === 'loaded') hostLoaded = true
    })
    if (hostLoaded) return true
    // second attempt: explicit load
    try {
      await (document as any).fonts.load('700 32px "Host Grotesk"')
      await (document as any).fonts.load('400 14px "Host Grotesk"')
      let ok = false
      document.fonts.forEach((f) => {
        if (/Host Grotesk/i.test(f.family) && f.status === 'loaded') ok = true
      })
      return ok
    } catch {
      return false
    }
  } catch {
    return false
  }
}

export async function validateAssets(root: HTMLElement, productImageSource: string | null): Promise<AssetValidation> {
  const errors: string[] = []
  const fontLoaded = await ensureFontReady()
  if (!fontLoaded) errors.push('Host Grotesk não carregou; usando fallback (Arial/Helvetica).')

  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  const results = await Promise.all(imgs.map(waitForImage))
  const logoImg = imgs.find((i) => i.classList.contains('brand-logo'))
  const productImg = imgs.find((i) => i.closest('.product-hero'))

  const logoLoaded = !!logoImg && results[imgs.indexOf(logoImg)] === true
  const productImageLoaded = productImageSource ? !!productImg && results[imgs.indexOf(productImg)] === true : false

  if (!logoLoaded) errors.push('Logo oficial não carregou.')
  if (productImageSource && !productImageLoaded) errors.push('Imagem oficial do produto não carregou.')

  return { logoLoaded, productImageLoaded, productImageSource, fontLoaded, errors }
}

export async function exportInfographicPng(
  root: HTMLElement,
): Promise<Blob> {
  const dataUrl = await toPng(root, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#EDF0F7',
    style: {
      // ensure font applied at capture time
      fontFamily: '"Host Grotesk", Arial, Helvetica, sans-serif',
    },
  })
  const res = await fetch(dataUrl)
  return await res.blob()
}

export async function uploadInfographicToStorage(opts: {
  blob: Blob
  resinId: string
  lang: 'pt' | 'en' | 'es'
}): Promise<string> {
  const ext = extensionFromMime(opts.blob.type, 'png')
  const path = `resins/${opts.resinId}-card-${opts.lang}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('model-images')
    .upload(path, opts.blob, { cacheControl: '3600', upsert: true, contentType: opts.blob.type || 'image/png' })
  if (error) throw error
  const { data } = supabase.storage.from('model-images').getPublicUrl(path)
  return data.publicUrl
}

export async function persistInfographicUrl(resinId: string, lang: 'pt' | 'en' | 'es', url: string) {
  const patch: any = { [`info_card_url_${lang}`]: url, info_card_status: 'ready', info_card_error: null }
  const { error } = await supabase.from('resins').update(patch).eq('id', resinId)
  if (error) throw error
}