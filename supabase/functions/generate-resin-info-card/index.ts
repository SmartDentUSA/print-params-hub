// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SD_LOGO = 'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png'

// Vercel-hosted puppeteer renderer (existing endpoint).
const RENDER_ENDPOINT = Deno.env.get('RENDER_TEMPLATE_URL') || 'https://admin.smartdent.com.br/api/render-template'

type Lang = 'pt' | 'en' | 'es'

interface MdEl { type: 'section' | 'subsection' | 'note' | 'bullet' | 'subbullet'; content: string; level?: number }
interface Parsed { pre: MdEl[]; post: MdEl[]; sections: { title: string; content: MdEl[] }[] }

function parseInstructions(instructions: string | null | undefined): Parsed {
  if (!instructions) return { pre: [], post: [], sections: [] }
  const lines = instructions.split('\n')
  const pre: MdEl[] = []
  const post: MdEl[] = []
  const sections: { title: string; content: MdEl[] }[] = []
  let current: 'pre' | 'post' | 'generic' | null = null
  let gTitle = ''
  let gContent: MdEl[] = []

  const flushGeneric = () => {
    if (current === 'generic' && gContent.length) {
      sections.push({ title: gTitle, content: gContent })
      gContent = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.match(/^##[^#]/)) {
      flushGeneric()
      const title = trimmed.replace(/^##\s*/, '')
      if (/^PRÉ[-\s]?PROCESSAMENTO|^PRE[-\s]?PROCESSING|^PRE[-\s]?PROCESAMIENTO/i.test(title)) {
        current = 'pre'; pre.push({ type: 'section', content: title })
      } else if (/^PÓS[-\s]?PROCESSAMENTO|^POST[-\s]?PROCESSING|^POST[-\s]?PROCESAMIENTO/i.test(title)) {
        current = 'post'; post.push({ type: 'section', content: title })
      } else {
        current = 'generic'; gTitle = title
      }
      continue
    }
    if (trimmed.match(/^###[^#]/)) {
      const sub = trimmed.replace(/^###\s*/, '')
      const el: MdEl = { type: 'subsection', content: sub }
      if (current === 'pre') pre.push(el)
      else if (current === 'post') post.push(el)
      else if (current === 'generic') gContent.push(el)
      continue
    }
    if (trimmed.startsWith('> ')) {
      const el: MdEl = { type: 'note', content: trimmed.replace(/^>\s*/, '') }
      if (current === 'pre') pre.push(el)
      else if (current === 'post') post.push(el)
      else if (current === 'generic') gContent.push(el)
      continue
    }
    if (trimmed.match(/^[•\-]\s+/)) {
      const indent = line.match(/^(\s+)/)
      const level = indent ? Math.floor(indent[1].length / 2) : 0
      const el: MdEl = { type: level > 0 ? 'subbullet' : 'bullet', content: trimmed.replace(/^[•\-]\s+/, ''), level }
      if (current === 'pre') pre.push(el)
      else if (current === 'post') post.push(el)
      else if (current === 'generic') gContent.push(el)
      continue
    }
    if (current) {
      const indent = line.match(/^(\s+)/)
      const level = indent ? Math.floor(indent[1].length / 2) : 0
      const el: MdEl = { type: level > 0 ? 'subbullet' : 'bullet', content: trimmed, level }
      if (current === 'pre') pre.push(el)
      else if (current === 'post') post.push(el)
      else if (current === 'generic') gContent.push(el)
    }
  }
  flushGeneric()
  return { pre, post, sections }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// Highlight bold-ish inline emphasis: converts **x** or numbers with units into <strong>.
function inlineFormat(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Bold time/temp patterns like "5 minutos" / "10 minutes" / "60°C" / "7000 rpm"
  s = s.replace(
    /(\d+(?:[.,]\d+)?\s?(?:°C|°F|minutos|minutes|minutos\.|min|rpm|µm|um|segundos|seconds|segundos|horas|hours|horas))/gi,
    '<strong>$1</strong>'
  )
  return s
}

const L = {
  pt: {
    title: 'Processo de Uso e Pós-Processamento',
    subtitle: 'Guia visual para manual de instruções',
    important: 'Importante',
    importantText:
      'O cumprimento rigoroso dos tempos e etapas descritos neste guia garante melhor acabamento, estabilidade dimensional e desempenho clínico da peça.',
    pre: 'PRÉ-PROCESSAMENTO',
    post: 'PÓS-PROCESSAMENTO',
  },
  en: {
    title: 'Usage and Post-Processing Guide',
    subtitle: 'Visual guide for the instructions manual',
    important: 'Important',
    importantText:
      'Strict adherence to the times and steps described in this guide ensures better finishing, dimensional stability and clinical performance of the part.',
    pre: 'PRE-PROCESSING',
    post: 'POST-PROCESSING',
  },
  es: {
    title: 'Proceso de Uso y Post-Procesamiento',
    subtitle: 'Guía visual para el manual de instrucciones',
    important: 'Importante',
    importantText:
      'El estricto cumplimiento de los tiempos y pasos descritos en esta guía garantiza mejor acabado, estabilidad dimensional y desempeño clínico de la pieza.',
    pre: 'PRE-PROCESAMIENTO',
    post: 'POST-PROCESAMIENTO',
  },
} as const

function renderElements(els: MdEl[]): string {
  // Group subsections with their following bullets/notes into columns.
  const cols: { title: string; icon: string; items: MdEl[] }[] = []
  let bucket: { title: string; icon: string; items: MdEl[] } | null = null
  const iconFor = (title: string) => {
    const t = title.toLowerCase()
    if (/limpeza|lavagem|wash|clean|limpieza/.test(t)) return '🧼'
    if (/filtr/.test(t)) return '🧴'
    if (/prepar|ambiente|temperatura/.test(t)) return '🌡️'
    if (/remoç|remov|remoc/.test(t)) return '🧲'
    if (/secagem|dry|secado|ar comprimido|air/.test(t)) return '💨'
    if (/cura|cure|uv/.test(t)) return '☀️'
    if (/refinamento|refin/.test(t)) return '🖊️'
    if (/glaze|aplic/.test(t)) return '🖌️'
    if (/final|polim/.test(t)) return '✨'
    return '🔹'
  }
  for (const el of els) {
    if (el.type === 'section') continue
    if (el.type === 'subsection') {
      if (bucket) cols.push(bucket)
      bucket = { title: el.content, icon: iconFor(el.content), items: [] }
      continue
    }
    if (!bucket) bucket = { title: '', icon: '', items: [] }
    bucket.items.push(el)
  }
  if (bucket) cols.push(bucket)

  const renderItem = (el: MdEl): string => {
    if (el.type === 'note') {
      return `<div class="callout"><span class="callout-ico">⚠️</span><span>${inlineFormat(el.content)}</span></div>`
    }
    if (el.type === 'subbullet') {
      return `<li class="sub"><span class="sub-dot">◦</span><span>${inlineFormat(el.content)}</span></li>`
    }
    return `<li><span class="dot">•</span><span>${inlineFormat(el.content)}</span></li>`
  }

  return cols
    .map(
      (c) => `
    <div class="col">
      ${c.title ? `<div class="col-head"><span class="col-icon">${c.icon}</span><h3>${escapeHtml(c.title)}</h3></div>` : ''}
      <ul>${c.items.map(renderItem).join('')}</ul>
    </div>`,
    )
    .join('')
}

function buildHtml(opts: {
  resinName: string
  productImage: string | null
  parsed: Parsed
  lang: Lang
}): string {
  const l = L[opts.lang]
  const preHtml = renderElements(opts.parsed.pre)
  const postHtml = renderElements(opts.parsed.post)
  const extras = opts.parsed.sections
    .map(
      (s) => `
    <section class="block block-extra">
      <div class="block-head">
        <span class="block-badge purple">☀️</span>
        <h2>${escapeHtml(s.title)}</h2>
      </div>
      <div class="cols">${renderElements(s.content)}</div>
    </section>`,
    )
    .join('')

  return `<!doctype html>
<html lang="${opts.lang}"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;background:#F8FAFC;font-family:'Inter',system-ui,sans-serif;color:#1E293B}
  .page{position:relative;padding:52px 56px 48px;background:#F8FAFC;overflow:hidden}
  .topbar{position:absolute;top:0;left:0;right:0;height:8px;background:#1D4ED8}
  .bg-pattern{position:absolute;top:120px;right:-30px;width:340px;height:340px;opacity:.35;
    background-image:linear-gradient(#CBD5E1 1px,transparent 1px),linear-gradient(90deg,#CBD5E1 1px,transparent 1px);
    background-size:22px 22px;-webkit-mask:radial-gradient(circle at 30% 30%,#000 40%,transparent 70%);
                    mask:radial-gradient(circle at 30% 30%,#000 40%,transparent 70%)}
  .header{display:flex;gap:24px;align-items:flex-start;justify-content:space-between;margin-bottom:28px}
  .header-left{flex:1}
  .logo{height:56px;margin-bottom:20px;object-fit:contain;object-position:left}
  h1{font-size:44px;font-weight:800;line-height:1.05;letter-spacing:-.02em;color:#0F172A}
  h1 .prod{color:#0F172A}
  h1 .plus{color:#2563EB}
  .subtitle{margin-top:10px;color:#475569;font-size:16px;display:flex;align-items:center;gap:10px}
  .subtitle::before{content:'';display:inline-block;width:34px;height:3px;background:#1D4ED8;border-radius:2px}
  .product-img-wrap{flex:0 0 210px;height:260px;display:flex;align-items:center;justify-content:center}
  .product-img{max-width:100%;max-height:100%;object-fit:contain}
  .block{border:2px solid;border-radius:22px;padding:22px 24px 20px;margin-bottom:22px;background:#fff;position:relative}
  .block-blue{border-color:#1D4ED8;background:#F0F5FF}
  .block-green{border-color:#16A34A;background:#F0FBF3}
  .block-extra{border-color:#7C3AED;background:#F6F1FE}
  .block-head{display:flex;align-items:center;gap:14px;margin:-38px 0 14px 0}
  .block-badge{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;box-shadow:0 6px 16px rgba(15,23,42,.15)}
  .block-badge.blue{background:#1D4ED8}
  .block-badge.green{background:#16A34A}
  .block-badge.purple{background:#7C3AED}
  .block-head h2{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:.02em}
  .block-head .num{color:#1D4ED8;margin-right:4px}
  .block-green .block-head .num{color:#16A34A}
  .block-extra .block-head .num{color:#7C3AED}
  .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
  .cols.four{grid-template-columns:repeat(4,minmax(0,1fr))}
  .col{min-width:0}
  .col-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .col-icon{width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:18px;color:#1D4ED8;flex:0 0 36px}
  .block-green .col-icon{color:#16A34A}
  .block-extra .col-icon{color:#7C3AED}
  .col h3{font-size:14px;font-weight:700;color:#0F172A;line-height:1.25}
  .col ul{list-style:none;padding:0;margin:0}
  .col li{display:flex;gap:8px;font-size:13px;line-height:1.45;color:#334155;margin-bottom:6px}
  .col li strong{color:#0F172A;font-weight:700}
  .col li .dot{color:#1D4ED8;font-weight:800;flex:0 0 10px}
  .block-green .col li .dot{color:#16A34A}
  .block-extra .col li .dot{color:#7C3AED}
  .col li.sub{margin-left:16px;font-size:12px;color:#64748B}
  .col li.sub .sub-dot{color:#94A3B8}
  .callout{margin-top:8px;padding:10px 12px;background:#FEF2F2;border-left:3px solid #EF4444;border-radius:6px;display:flex;gap:8px;font-size:12.5px;color:#7F1D1D;line-height:1.4}
  .callout .callout-ico{flex:0 0 auto}
  .footer{margin-top:18px;padding:18px 22px;background:#FEF2F2;border-radius:14px;display:flex;gap:14px;align-items:flex-start;border:1px solid #FECACA}
  .footer .shield{width:44px;height:44px;border-radius:50%;background:#1D4ED8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 44px}
  .footer .imp{font-size:20px;font-weight:800;color:#1D4ED8;margin-bottom:4px}
  .footer p{font-size:13px;color:#334155;line-height:1.5}
</style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>
    <div class="bg-pattern"></div>
    <header class="header">
      <div class="header-left">
        <img class="logo" src="${SD_LOGO}" alt="Smart Dent"/>
        <h1><span class="prod">${escapeHtml(l.title)} —</span><br/><span class="plus">${escapeHtml(opts.resinName)}</span></h1>
        <div class="subtitle">${escapeHtml(l.subtitle)}</div>
      </div>
      ${opts.productImage ? `<div class="product-img-wrap"><img class="product-img" src="${opts.productImage}" alt="${escapeHtml(opts.resinName)}"/></div>` : ''}
    </header>

    ${preHtml ? `
    <section class="block block-blue">
      <div class="block-head">
        <span class="block-badge blue">🌡️</span>
        <h2><span class="num">1)</span> ${escapeHtml(l.pre)}</h2>
      </div>
      <div class="cols">${preHtml}</div>
    </section>` : ''}

    ${postHtml ? `
    <section class="block block-green">
      <div class="block-head">
        <span class="block-badge green">⚙️</span>
        <h2><span class="num">2)</span> ${escapeHtml(l.post)}</h2>
      </div>
      <div class="cols">${postHtml}</div>
    </section>` : ''}

    ${extras}

    <div class="footer">
      <div class="shield">🛡</div>
      <div>
        <div class="imp">${escapeHtml(l.important)}</div>
        <p>${escapeHtml(l.importantText)}</p>
      </div>
    </div>
  </div>
</body></html>`
}

async function renderPng(html: string): Promise<Uint8Array> {
  const res = await fetch(RENDER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width: 1080, height: 1500 }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`render-template ${res.status}: ${t.slice(0, 300)}`)
  }
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { resin_id, languages } = await req.json()
    if (!resin_id) {
      return new Response(JSON.stringify({ error: 'resin_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const langs: Lang[] = Array.isArray(languages) && languages.length
      ? (languages.filter((l: string) => ['pt', 'en', 'es'].includes(l)) as Lang[])
      : ['pt', 'en', 'es']

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: resin, error: rErr } = await supabase
      .from('resins')
      .select(
        'id, slug, name, name_en, name_es, image_url, processing_instructions, processing_instructions_en, processing_instructions_es',
      )
      .eq('id', resin_id)
      .maybeSingle()
    if (rErr) throw rErr
    if (!resin) throw new Error('Resin not found')

    const instructionsFor = (lang: Lang): string | null => {
      if (lang === 'en') return resin.processing_instructions_en || resin.processing_instructions
      if (lang === 'es') return resin.processing_instructions_es || resin.processing_instructions
      return resin.processing_instructions
    }
    const nameFor = (lang: Lang): string => {
      if (lang === 'en') return resin.name_en || resin.name
      if (lang === 'es') return resin.name_es || resin.name
      return resin.name
    }

    const results: Record<string, string> = {}
    const timestamp = Date.now()
    const safeSlug = (resin.slug || resin.id).toString().replace(/[^a-z0-9-]/gi, '-').toLowerCase()

    for (const lang of langs) {
      const raw = instructionsFor(lang)
      if (!raw || !raw.trim()) continue
      const parsed = parseInstructions(raw)
      const html = buildHtml({
        resinName: nameFor(lang),
        productImage: resin.image_url,
        parsed,
        lang,
      })
      const png = await renderPng(html)
      const path = `resin-info-cards/${safeSlug}-${lang}-${timestamp}.png`
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, png, { contentType: 'image/png', upsert: true, cacheControl: '3600' })
      if (upErr) throw new Error(`Upload ${lang}: ${upErr.message}`)
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
      results[lang] = pub.publicUrl
    }

    const update: Record<string, unknown> = { info_card_generated_at: new Date().toISOString() }
    if (results.pt) update.info_card_url_pt = results.pt
    if (results.en) update.info_card_url_en = results.en
    if (results.es) update.info_card_url_es = results.es

    const { error: uErr } = await supabase.from('resins').update(update).eq('id', resin_id)
    if (uErr) throw uErr

    return new Response(JSON.stringify({ ok: true, urls: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[generate-resin-info-card] error:', err)
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})