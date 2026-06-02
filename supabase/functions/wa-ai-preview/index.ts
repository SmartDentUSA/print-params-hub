// Gera preview de mensagem IA para nó "IA + Conteúdo" do construtor WA Groups.
// Reusa a mesma lógica do wa-dispatcher (sem enfileirar nada).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/evolution.ts'
import { resolveAiContent } from '../_shared/wa-ai-content.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const { text, url, title, provider } = await resolveAiContent(sb, {
      ai_source_type, ai_source_id, ai_source_title, ai_prompt_override,
    })
    return Response.json(
      { ok: true, preview: text, provider, chars: text.length, title, url },
      { headers: corsHeaders },
    )
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message ?? String(err) },
      { status: 500, headers: corsHeaders },
    )
  }
})