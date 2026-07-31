import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CF_PESSOA_IMPRESSORA = 772728
const CF_PESSOA_SCANNER = 772727

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('PIPERUN_API_KEY')!
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const days = Number(new URL(req.url).searchParams.get('days') || '45')
  const dry = new URL(req.url).searchParams.get('dry') === '1'

  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await sb
    .from('lia_attendances')
    .select('id,nome,pessoa_piperun_id,impressora_modelo,scanner_marca')
    .is('merged_into', null)
    .gte('created_at', since)
    .not('pessoa_piperun_id', 'is', null)
    .limit(500)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const BRANDS = ['ANYCUBIC','ELEGOO','CREALITY','PHROZEN','RAYSHAPE','FLASHFORGE','SPRINTRAY','FORMLABS','STRAUMANN','WANHAO','KULZER']
  const targets = (data || []).filter((l: any) => BRANDS.includes(String(l.impressora_modelo || '').toUpperCase()) || l.scanner_marca)
  if (dry) return new Response(JSON.stringify({ count: targets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  let ok = 0, fail = 0
  const errors: string[] = []
  for (const l of targets) {
    const fields: Array<{ id: number; valor: string }> = []
    const imp = String(l.impressora_modelo || '').toUpperCase()
    if (BRANDS.includes(imp)) fields.push({ id: CF_PESSOA_IMPRESSORA, valor: imp })
    if (l.scanner_marca) fields.push({ id: CF_PESSOA_SCANNER, valor: String(l.scanner_marca) })
    if (!fields.length) continue
    const res = await fetch(`https://api.pipe.run/v1/persons/${Math.trunc(Number(l.pessoa_piperun_id))}?token=${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', token: key },
      body: JSON.stringify({ fields }),
    })
    if (res.ok) ok++
    else { fail++; if (errors.length < 5) errors.push(`${l.pessoa_piperun_id}: ${res.status} ${(await res.text()).slice(0, 200)}`) }
    await new Promise((r) => setTimeout(r, 120))
  }
  return new Response(JSON.stringify({ total: targets.length, ok, fail, errors }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
