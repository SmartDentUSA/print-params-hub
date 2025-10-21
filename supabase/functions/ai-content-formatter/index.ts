import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LinkMapItem {
  id: string
  url: string
  priority: number
  source: 'external' | 'knowledge'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt, rawText, categoryLetter } = await req.json()

    if (!rawText) {
      throw new Error('rawText é obrigatório')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🤖 Iniciando geração de conteúdo por IA...')

    // 1. Buscar keywords do repositório
    const linkMap = await fetchKeywordsRepository(supabaseClient, categoryLetter)

    // 2. Gerar conteúdo com IA
    const formattedHTML = await generateWithLovableAI(prompt, rawText, linkMap)

    // 3. Atualizar usage_count das keywords usadas
    await trackKeywordUsage(supabaseClient, formattedHTML, linkMap)

    console.log('✅ Conteúdo gerado com sucesso')

    return new Response(
      JSON.stringify({ success: true, formattedHTML }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro na geração de conteúdo:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function fetchKeywordsRepository(
  supabase: any,
  categoryLetter?: string
): Promise<Map<string, LinkMapItem>> {
  
  const linkMap = new Map<string, LinkMapItem>()

  console.log('📡 Buscando keywords do repositório...')

  // 1. Buscar external_links (approved only)
  const { data: externalLinks } = await supabase
    .from('external_links')
    .select('*')
    .eq('approved', true)
    .order('relevance_score', { ascending: false })

  if (externalLinks) {
    for (const link of externalLinks) {
      const priority = calculatePriority(link)
      
      // Adicionar nome da keyword
      linkMap.set(link.name.toLowerCase(), {
        id: link.id,
        url: link.url,
        priority,
        source: 'external'
      })

      // Adicionar related_keywords
      if (link.related_keywords) {
        for (const relatedKw of link.related_keywords) {
          if (!linkMap.has(relatedKw.toLowerCase())) {
            linkMap.set(relatedKw.toLowerCase(), {
              id: link.id,
              url: link.url,
              priority: priority * 0.8,
              source: 'external'
            })
          }
        }
      }
    }
  }

  // 2. Buscar knowledge_contents
  const { data: knowledgeContents } = await supabase
    .from('knowledge_contents')
    .select('id, title, slug, category_id, keywords')
    .eq('active', true)

  if (knowledgeContents) {
    for (const content of knowledgeContents) {
      const url = `/base-conhecimento/${content.category_id}/${content.slug}`
      const basePriority = 50

      // Adicionar título
      if (!linkMap.has(content.title.toLowerCase())) {
        linkMap.set(content.title.toLowerCase(), {
          id: content.id,
          url,
          priority: basePriority,
          source: 'knowledge'
        })
      }

      // Adicionar keywords
      if (content.keywords) {
        for (const kw of content.keywords) {
          if (!linkMap.has(kw.toLowerCase())) {
            linkMap.set(kw.toLowerCase(), {
              id: content.id,
              url,
              priority: basePriority * 0.8,
              source: 'knowledge'
            })
          }
        }
      }
    }
  }

  console.log(`✅ ${linkMap.size} keywords carregadas no mapa`)
  return linkMap
}

function calculatePriority(link: any): number {
  const typeScores: Record<string, number> = {
    primary: 10,
    'long-tail': 8,
    secondary: 5,
    negative: 0
  }

  const intentScores: Record<string, number> = {
    transactional: 10,
    commercial: 8,
    informational: 6,
    navigational: 4
  }

  const usagePenalty = Math.min(link.usage_count / 10, 5)

  return (
    (link.relevance_score || 50) * 0.4 +
    (Math.min(link.monthly_searches / 100, 100)) * 0.3 +
    (typeScores[link.keyword_type] || 5) * 2 +
    (intentScores[link.search_intent] || 5) * 1 -
    usagePenalty
  )
}

async function generateWithLovableAI(
  customPrompt: string,
  rawText: string,
  linkMap: Map<string, LinkMapItem>
): Promise<string> {
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada. Configure em Settings -> Edge Functions.')
  }

  // Ordenar keywords por prioridade
  const sortedKeywords = Array.from(linkMap.entries())
    .sort((a, b) => b[1].priority - a[1].priority)
    .slice(0, 50)

  // Criar lista de links para o prompt
  const linkInstructions = sortedKeywords
    .map(([keyword, data]) => `"${keyword}" -> ${data.url} (prioridade: ${Math.round(data.priority)})`)
    .join('\n')

  const defaultPrompt = `Você é um especialista em SEO e formatação de conteúdo para blog odontológico.

Receba o texto bruto abaixo e:
1. Estruture em HTML semântico (<h2>, <h3>, <p>, <ul>, <blockquote>)
2. Adicione classes CSS apropriadas (content-card, benefit-card, cta-panel)
3. Otimize para SEO (use palavras-chave naturalmente)
4. Insira links internos automaticamente quando encontrar palavras-chave relevantes
5. Mantenha tom profissional e didático`

  const fullPrompt = `${customPrompt || defaultPrompt}

🔗 LISTA DE LINKS INTERNOS PARA INSERIR AUTOMATICAMENTE:

${linkInstructions}

⚠️ REGRAS DE INSERÇÃO DE LINKS:
1. Insira <a href="URL">palavra-chave</a> quando encontrar as palavras-chave acima
2. MÁXIMO 1 link por palavra-chave (primeira ocorrência apenas)
3. MÁXIMO 10-15 links internos por artigo
4. Priorize keywords com maior score de prioridade
5. Links devem ser naturais no contexto
6. Use title="" nos links para acessibilidade

📝 ESTRUTURA HTML COM EXEMPLOS OBRIGATÓRIOS:

✅ EXEMPLO 1 - SEÇÃO COM CARD:
<h2>Principais Benefícios</h2>
<div class="content-card">
  <p>A tecnologia de impressão 3D revolucionou a odontologia digital...</p>
  <ul>
    <li>Precisão de até 20 microns</li>
    <li>Economia de tempo em 60%</li>
  </ul>
</div>

✅ EXEMPLO 2 - GRID DE BENEFÍCIOS (obrigatório pelo menos 1):
<h2>Vantagens da Impressão 3D</h2>
<div class="grid-benefits">
  <div class="benefit-card">
    <h3>⚡ Velocidade</h3>
    <p>Reduza o tempo de produção em até 60% com scanners de alta performance.</p>
  </div>
  <div class="benefit-card">
    <h3>🎯 Precisão</h3>
    <p>Alcance precisão de 5 microns com a tecnologia de ponta.</p>
  </div>
  <div class="benefit-card">
    <h3>💰 Economia</h3>
    <p>Reduza custos operacionais com fluxo digital completo.</p>
  </div>
</div>

✅ EXEMPLO 2B - GRID 3 COLUNAS FIXAS (para dados/estatísticas):
<h2>📊 Dados Técnicos</h2>
<div class="grid-3">
  <div>
    <h3>20µm</h3>
    <p>Precisão média</p>
  </div>
  <div>
    <h3>60%</h3>
    <p>Redução de tempo</p>
  </div>
  <div>
    <h3>R$ 15k</h3>
    <p>Economia anual</p>
  </div>
</div>

✅ EXEMPLO 2C - BADGES (para categorização e destaque):
<h2><span class="badge badge-primary">🏆 Premium</span> Scanners de Alta Performance</h2>
<p>Os melhores scanners do mercado <span class="badge">⚡ Novidade</span></p>

✅ EXEMPLO 3 - CTA (obrigatório 1-2 por artigo):
<div class="cta-panel">
  <h3>💡 Quer saber mais sobre impressoras 3D?</h3>
  <p>Explore nosso guia completo sobre resinas odontológicas</p>
  <a href="/base-conhecimento/A/resinas-3d">Acessar Guia Completo</a>
</div>

✅ EXEMPLO 3B - BOTÕES ESTILIZADOS:
<div class="cta-panel">
  <h3>💡 Quer saber mais?</h3>
  <p>Explore nosso guia completo</p>
  <a href="/guia" class="btn btn-primary">📖 Acessar Guia</a>
  <a href="/contato" class="btn btn-outline">📞 Falar com Especialista</a>
</div>

✅ EXEMPLO 4 - BLOCKQUOTE (para citações e dados importantes):
<blockquote>
  <p>A adoção de scanners intraorais aumentou a produtividade das clínicas em 70%, segundo estudo da ABO 2024.</p>
</blockquote>

⚠️ REGRAS OBRIGATÓRIAS:
1. SEMPRE use <div class="content-card"> para agrupar conteúdo relacionado
2. Use <div class="grid-benefits"> para listas de benefícios (mínimo 3 cards)
3. Use <div class="grid-3"> para dados/estatísticas (3 colunas fixas)
4. SEMPRE adicione 1-2 <div class="cta-panel"> com <a class="btn btn-primary">
5. Use <span class="badge"> ou <span class="badge badge-primary"> para categorização
6. Use <blockquote> para destacar citações importantes (terá aspas decorativas automáticas)
7. Use <h2> para seções principais e <h3> dentro de cards
8. Todos os parágrafos devem estar dentro de <p> tags

🎯 TEXTO BRUTO PARA FORMATAR:
${rawText}

⚠️ IMPORTANTE: Retorne APENAS o HTML formatado, sem markdown, sem \`\`\`html, apenas o conteúdo puro.
`

  console.log('🚀 Enviando para Lovable AI...')

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { 
          role: 'system', 
          content: `Você é um especialista em SEO e HTML semântico especializado em blogs odontológicos.

IMPORTANTE:
- Retorne APENAS HTML puro, sem markdown, sem \`\`\`html
- SEMPRE use as classes CSS especificadas (content-card, benefit-card, cta-panel, grid-benefits)
- Insira links internos automaticamente quando encontrar palavras-chave
- Estruture o conteúdo de forma profissional e visualmente atraente
- Use EXATAMENTE as estruturas HTML dos exemplos fornecidos` 
        },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit excedido. Tente novamente em alguns segundos.')
    }
    if (response.status === 402) {
      throw new Error('Créditos Lovable AI esgotados. Adicione créditos em Settings -> Workspace.')
    }
    throw new Error(`Erro ao gerar conteúdo: ${response.status}`)
  }

  const aiData = await response.json()
  const formattedHTML = aiData.choices[0].message.content

  return formattedHTML
}

async function trackKeywordUsage(
  supabase: any,
  htmlContent: string,
  linkMap: Map<string, LinkMapItem>
) {
  console.log('📊 Rastreando uso de keywords...')

  // Extrair todos os hrefs do HTML gerado
  const hrefRegex = /href="([^"]+)"/g
  const usedUrls = new Set<string>()
  let match

  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    usedUrls.add(match[1])
  }

  // Identificar quais external_links foram usadas
  const usedExternalLinkIds = new Set<string>()
  
  for (const [keyword, data] of linkMap.entries()) {
    if (data.source === 'external' && usedUrls.has(data.url)) {
      usedExternalLinkIds.add(data.id)
    }
  }

  // Atualizar usage_count e last_used_at
  for (const linkId of usedExternalLinkIds) {
    try {
      const { data: current } = await supabase
        .from('external_links')
        .select('usage_count')
        .eq('id', linkId)
        .single()

      if (current) {
        await supabase
          .from('external_links')
          .update({
            usage_count: (current.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', linkId)
      }
    } catch (err) {
      console.error(`❌ Erro ao atualizar keyword ${linkId}:`, err.message)
    }
  }

  console.log(`✅ ${usedExternalLinkIds.size} keywords rastreadas`)
}
