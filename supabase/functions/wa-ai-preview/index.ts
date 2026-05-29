// Gera preview de mensagem IA para nó "IA + Conteúdo" do construtor WA Groups.
// Reusa a mesma lógica do wa-dispatcher (sem enfileirar nada).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/evolution.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DEEPSEEK_KEY     = Deno.env.get('DEEPSEEK_API_KEY')
const GEMINI_KEY       = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { ai_source_type, ai_source_id, ai_source_title, ai_prompt_override } = await req.json()
    if (!ai_source_type || !ai_source_id) {
      return Response.json(
        { ok: false, error: 'ai_source_type e ai_source_id são obrigatórios' },
        { status: 400, headers: corsHeaders },
      )
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    let ctx = '', title = ai_source_title ?? ''

    if (ai_source_type === 'article') {
      const { data } = await sb.from('knowledge_contents')
        .select('title, meta_description, excerpt, content_html').eq('id', ai_source_id).single()
      if (data) {
        title = data.title ?? title
        const body = (data.content_html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        ctx = `Título: ${data.title}\nResumo: ${data.excerpt ?? data.meta_description ?? ''}\n\n${body.substring(0, 1500)}`
      }
    } else if (ai_source_type === 'product') {
      const { data } = await sb.from('system_a_catalog')
        .select('name, description, category').eq('id', ai_source_id).single()
      if (data) {
        title = data.name ?? title
        ctx = `Produto: ${data.name}\nCategoria: ${data.category ?? ''}\n${(data.description ?? '').substring(0, 1000)}`
      }
    } else if (ai_source_type === 'video') {
      const { data } = await sb.from('knowledge_videos')
        .select('title, description').eq('id', ai_source_id).single()
      if (data) {
        title = data.title ?? title
        ctx = `Vídeo: ${data.title}\n${(data.description ?? '').substring(0, 800)}`
      }
    }

    const sys = `Você é o assistente de marketing da Smart Dent (tecnologia odontológica digital, Brasil).
Crie uma mensagem para grupo de WhatsApp de dentistas e laboratórios de prótese.
Regras: máximo 280 caracteres, português, profissional, máximo 2 emojis, sem hashtags.
Sem preços (política content-generation-policy-no-prices-v2).`

    const prompt = (ai_prompt_override as string)
      || `Com base no conteúdo abaixo, crie mensagem para grupo WA:\n\n${ctx || `Conteúdo: ${title || 'SmartDent'}`}`

    let text = ''
    let provider = 'fallback'

    if (DEEPSEEK_KEY) {
      try {
        const r = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
            max_tokens: 200, temperature: 0.7,
          }),
        })
        if (r.ok) {
          const d = await r.json()
          text = d.choices?.[0]?.message?.content?.trim() ?? ''
          if (text) provider = 'deepseek'
        }
      } catch { /* fallback */ }
    }

    if (!text && GEMINI_KEY) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${sys}\n\n${prompt}` }] }],
              generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
            }),
          },
        )
        if (r.ok) {
          const d = await r.json()
          text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
          if (text) provider = 'gemini'
        }
      } catch { /* fallback */ }
    }

    if (!text) {
      text = `${title || 'Smart Dent'} — confira o conteúdo completo em nosso portal! 📲`
    }

    return Response.json(
      { ok: true, preview: text, provider, chars: text.length, title },
      { headers: corsHeaders },
    )
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message ?? String(err) },
      { status: 500, headers: corsHeaders },
    )
  }
})