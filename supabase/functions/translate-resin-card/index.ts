// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { callPoe } from '../_shared/providers/poe.ts'

type Lang = 'pt' | 'en' | 'es'

const LABELS: Record<Lang, { title: string; subtitle: string; important: string }> = {
  pt: {
    title: 'Processo de Uso e Pós-Processamento',
    subtitle: 'Guia visual para manual de instruções',
    important:
      'O cumprimento rigoroso dos tempos e etapas descritos neste guia garante melhor acabamento, estabilidade dimensional e desempenho clínico da peça.',
  },
  en: {
    title: 'Usage and Post-Processing Guide',
    subtitle: 'Visual guide for the instructions manual',
    important:
      'Strict adherence to the times and steps described in this guide ensures better finishing, dimensional stability and clinical performance of the part.',
  },
  es: {
    title: 'Proceso de Uso y Post-Procesamiento',
    subtitle: 'Guía visual para el manual de instrucciones',
    important:
      'El estricto cumplimiento de los tiempos y pasos descritos en esta guía garantiza mejor acabado, estabilidad dimensional y desempeño clínico de la pieza.',
  },
}

function extractJson(raw: string): any | null {
  if (!raw) return null
  const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(t) } catch {}
  const a = t.indexOf('{'); const b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch {} }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { resinId, plan, targetLang, forceRefresh } = await req.json() as { resinId?: string; plan: any; targetLang: Lang; forceRefresh?: boolean }
    if (!plan || !targetLang || !['en', 'es', 'pt'].includes(targetLang)) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // cache lookup
    if (resinId && !forceRefresh) {
      const col = `info_card_plan_${targetLang}` as const
      const { data } = await supabase.from('resins').select(col).eq('id', resinId).maybeSingle() as any
      const cached = data?.[col]
      if (cached && cached.sections?.length) {
        return new Response(JSON.stringify({ plan: cached, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (targetLang === 'pt') {
      // pt = fonte; retorna direto
      return new Response(JSON.stringify({ plan }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const langName = targetLang === 'en' ? 'English (US)' : 'Spanish (LATAM)'
    const labels = LABELS[targetLang]

    const system = `You are a professional technical translator for dental/3D printing content.
Translate the JSON below from Portuguese (BR) to ${langName}.
Rules:
- Preserve the exact JSON schema and every array/object.
- Do NOT translate technical values (e.g. "60°C", "3 min", "405 nm").
- Do NOT translate brand/product names.
- Keep markdown-like tokens (**bold**) intact.
- Return ONLY valid JSON, no prose, no code fences.
- Use these translated labels: title="${labels.title}", subtitle="${labels.subtitle}", important="${labels.important}".`

    const user = JSON.stringify({ ...plan, title: labels.title, subtitle: labels.subtitle, important: labels.important })

    const result = await callPoe({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      timeout_ms: 60000,
    })

    if (!result.ok || !result.text) {
      return new Response(JSON.stringify({ error: result.error || 'poe_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const translated = extractJson(result.text)
    if (!translated || !Array.isArray(translated.sections)) {
      return new Response(JSON.stringify({ error: 'invalid_llm_output', raw: result.text.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // persist cache
    if (resinId) {
      const patch: any = { [`info_card_plan_${targetLang}`]: translated }
      await supabase.from('resins').update(patch).eq('id', resinId)
    }

    return new Response(JSON.stringify({ plan: translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})