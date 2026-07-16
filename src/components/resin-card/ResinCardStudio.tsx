import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Loader2, Image as ImageIcon, Download, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { InfographicCard } from './InfographicCard'
import { parseInstructionsMd } from './parseInstructionsMd'
import type { CardPlan, Lang } from './types'
import { resolveProductImage } from '@/utils/resolveProductImage'
import { uploadExternalImage } from '@/utils/uploadExternalImage'
import {
  validateAssets,
  exportInfographicPng,
  uploadInfographicToStorage,
  persistInfographicUrl,
  type AssetValidation,
} from './exportInfographic'

type Props = {
  resin: any
  onCardUrlChanged?: (lang: Lang, url: string | null) => void
}

function planSourceSignature(plan: CardPlan): string {
  const source = JSON.stringify(plan)
  let hash = 2166136261
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16)}`
}

function matchesSource(plan: any, signature: string): boolean {
  return !!plan?.sections?.length && plan?._sourceSignature === signature
}

export function ResinCardStudio({ resin, onCardUrlChanged }: Props) {
  const { toast } = useToast()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLang, setPreviewLang] = useState<Lang>('pt')
  const [busyLang, setBusyLang] = useState<Lang | null>(null)
  const [validation, setValidation] = useState<AssetValidation | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Overrides só para traduções obtidas em runtime (EN/ES via edge function).
  // PT é SEMPRE recomputado a partir das instruções vivas — sem cache local.
  const [translationOverrides, setTranslationOverrides] = useState<Record<Lang, CardPlan | null>>({ pt: null, en: null, es: null })
  const rootRef = useRef<HTMLDivElement>(null)

  // Rehidrata do banco por id para evitar estado obsoleto após backfill/reimport.
  const [hydratedResin, setHydratedResin] = useState<any>(resin)
  useEffect(() => {
    setHydratedResin(resin)
    const id = resin?.id
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('resins')
        .select(
          'image_url, image_urls, image_background_removed_url, name, info_card_plan_pt, info_card_plan_en, info_card_plan_es, processing_instructions',
        )
        .eq('id', id)
        .maybeSingle()
      if (cancelled || !data) return
      setHydratedResin((prev: any) => ({ ...(prev || {}), ...data }))
    })()
    return () => {
      cancelled = true
    }
  }, [resin?.id])

  const productImageUrl = useMemo(() => resolveProductImage(hydratedResin), [hydratedResin])
  const missingProductImage = !productImageUrl
  const isExternalProductImage = useMemo(() => {
    if (!productImageUrl) return false
    return !productImageUrl.includes('supabase.co')
  }, [productImageUrl])
  const [reimporting, setReimporting] = useState(false)

  async function handleReimportImage() {
    if (!productImageUrl || !resin?.id) return
    setReimporting(true)
    try {
      const safeName = (hydratedResin?.name || resin?.name || 'resin')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'resin'
      const publicUrl = await uploadExternalImage(productImageUrl, `resin-${safeName}-${resin.id}`)
      const { error: upErr } = await supabase
        .from('resins')
        .update({ image_background_removed_url: publicUrl } as any)
        .eq('id', resin.id)
      if (upErr) throw upErr
      setHydratedResin((prev: any) => ({ ...(prev || {}), image_background_removed_url: publicUrl }))
      toast({ title: '✅ Imagem reimportada', description: 'Imagem oficial atualizada.' })
    } catch (e: any) {
      toast({
        title: '❌ Falha ao reimportar imagem',
        description: e?.message || String(e),
        variant: 'destructive',
      })
    } finally {
      setReimporting(false)
    }
  }

  // Instruções em edição no form (prop) têm prioridade sobre o DB hidratado,
  // para que qualquer alteração no textarea reflita imediatamente no card visual.
  const liveInstructions = resin?.processing_instructions ?? hydratedResin?.processing_instructions ?? ''
  const instructionsChanged = liveInstructions !== (hydratedResin?.processing_instructions ?? '')

  // Qualquer alteração no texto invalida traduções criadas para a versão anterior.
  useEffect(() => {
    setTranslationOverrides({ pt: null, en: null, es: null })
  }, [liveInstructions])

  const planPt = useMemo<CardPlan>(() => {
    // Sempre reparseia a partir das instruções vivas — cache do DB pode estar defasado.
    const parsed = parseInstructionsMd(liveInstructions || '')
    if (parsed.sections.length) return parsed
    const cached = hydratedResin?.info_card_plan_pt
    if (!instructionsChanged && cached && Array.isArray(cached.sections) && cached.sections.length) return cached
    return parsed
  }, [liveInstructions, instructionsChanged, hydratedResin?.info_card_plan_pt])

  const canExport = !!resin?.id && planPt.sections.length > 0
  const sourceSignature = useMemo(() => planSourceSignature(planPt), [planPt])

  async function ensurePlan(lang: Lang): Promise<CardPlan> {
    if (lang === 'pt') return planPt
    const override = translationOverrides[lang]
    if (matchesSource(override, sourceSignature)) return override as CardPlan
    const cachedDb = hydratedResin?.[`info_card_plan_${lang}`]
    if (!instructionsChanged && matchesSource(cachedDb, sourceSignature)) return cachedDb
    const { data, error } = await supabase.functions.invoke('translate-resin-card', {
      body: { resinId: resin.id, plan: planPt, targetLang: lang, sourceSignature, forceRefresh: true },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    const p = data?.plan as CardPlan
    if (!p?.sections?.length) throw new Error('Tradução vazia')
    setTranslationOverrides((prev) => ({ ...prev, [lang]: p }))
    // persist PT plan too, para futuras traduções
    await supabase.from('resins').update({ info_card_plan_pt: planPt } as any).eq('id', resin.id).then(() => {})
    return p
  }

  async function handleExport(lang: Lang) {
    if (!canExport) return
    if (missingProductImage) {
      setError('MISSING_OFFICIAL_PRODUCT_IMAGE: cadastre uma imagem oficial do produto antes de exportar.')
      return
    }
    setBusyLang(lang)
    setError(null)
    try {
      const plan = await ensurePlan(lang)
      if (lang !== 'pt') {
        setTranslationOverrides((prev) => ({ ...prev, [lang]: plan }))
      }
      setPreviewLang(lang)
      setPreviewOpen(true)
      // give React a tick to render offscreen
      await new Promise((r) => setTimeout(r, 60))
      const root = rootRef.current
      if (!root) throw new Error('Preview não renderizado')
      const v = await validateAssets(root, productImageUrl)
      setValidation(v)
      if (!v.logoLoaded || !v.productImageLoaded || !v.fontLoaded) {
        throw new Error(v.errors.join(' • ') || 'Falha na validação de assets')
      }
      const blob = await exportInfographicPng(root)
      const url = await uploadInfographicToStorage({ blob, resinId: resin.id, lang })
      await persistInfographicUrl(resin.id, lang, url)
      onCardUrlChanged?.(lang, url)
      toast({ title: `✅ Card ${lang.toUpperCase()} exportado` })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: `❌ Falha ao exportar ${lang.toUpperCase()}`, description: msg, variant: 'destructive' })
    } finally {
      setBusyLang(null)
    }
  }

  const previewPlan: CardPlan = (() => {
    if (previewLang === 'pt') return planPt
    const override = translationOverrides[previewLang]
    if (matchesSource(override, sourceSignature)) return override as CardPlan
    const cachedDb = hydratedResin?.[`info_card_plan_${previewLang}`]
    if (!instructionsChanged && matchesSource(cachedDb, sourceSignature)) return cachedDb
    return planPt
  })()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={!canExport}
          title={!canExport ? 'Salve a resina e adicione instruções em PT' : 'Alternar pré-visualização'}
        >
          <Eye className="w-4 h-4 mr-1" /> {previewOpen ? 'Ocultar preview' : 'Pré-visualizar Card'}
        </Button>
        {(['pt', 'en', 'es'] as const).map((lang) => (
          <Button
            key={lang}
            type="button"
            size="sm"
            variant="default"
            disabled={!canExport || !!busyLang || missingProductImage}
            onClick={() => handleExport(lang)}
          >
            {busyLang === lang ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
            Exportar {lang.toUpperCase()}
          </Button>
        ))}
        {!resin?.id && (
          <span className="text-xs text-muted-foreground">Salve a resina antes de exportar</span>
        )}
      </div>

      {missingProductImage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm flex gap-2 items-start text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            <div className="font-semibold">MISSING_OFFICIAL_PRODUCT_IMAGE</div>
            <div>Cadastre uma imagem oficial do produto (aba Imagens) para liberar a exportação.</div>
          </div>
        </div>
      )}

      {!missingProductImage && isExternalProductImage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm flex gap-3 items-start text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Imagem hospedada em CDN externo</div>
            <div className="text-xs opacity-90 mb-2">
              A exportação exige CORS liberado. Reimporte para o Storage do Supabase.
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleReimportImage}
              disabled={reimporting}
            >
              {reimporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <ImageIcon className="w-4 h-4 mr-1" />
              )}
              Reimportar imagem para o Storage
            </Button>
          </div>
        </div>
      )}

      {validation && (
        <div className="flex flex-wrap gap-3 text-xs">
          <ValidationChip ok={validation.fontLoaded} label="Host Grotesk" />
          <ValidationChip ok={validation.logoLoaded} label="Logo oficial" />
          <ValidationChip ok={validation.productImageLoaded} label="Imagem do produto" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {previewOpen && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">Idioma da preview:</Label>
            {(['pt', 'en', 'es'] as const).map((l) => (
              <Button
                key={l}
                type="button"
                size="sm"
                variant={previewLang === l ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={async () => {
                  try {
                    await ensurePlan(l)
                    setPreviewLang(l)
                  } catch (e: any) {
                    toast({ title: 'Falha ao traduzir', description: e?.message, variant: 'destructive' })
                  }
                }}
              >
                {l.toUpperCase()}
              </Button>
            ))}
            <Badge variant="secondary" className="text-[10px]">preview em escala reduzida</Badge>
          </div>
          <div
            className="border rounded-md bg-muted/30 overflow-hidden"
            style={{ maxWidth: '100%' }}
          >
            <div style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: 1080 }}>
              <InfographicCard
                ref={rootRef}
                plan={previewPlan}
                resinName={hydratedResin?.name || resin?.name || ''}
                productImageUrl={productImageUrl}
              />
            </div>
          </div>
        </div>
      )}

      {/* Offscreen full-size render (fallback when preview is closed) */}
      {!previewOpen && (
        <div style={{ position: 'absolute', left: -99999, top: 0, width: 1080, pointerEvents: 'none' }} aria-hidden>
          <InfographicCard
            ref={rootRef}
            plan={previewPlan}
            resinName={hydratedResin?.name || resin?.name || ''}
            productImageUrl={productImageUrl}
          />
        </div>
      )}
    </div>
  )
}

function ValidationChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  )
}