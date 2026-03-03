import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logAIUsage, extractUsage } from '../_shared/log-ai-usage.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface LinkMapItem {
  id: string
  url: string
  priority: number
  source: 'external' | 'knowledge' | 'document' | 'catalog_product'
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

  // 2. Buscar knowledge_contents com letra da categoria
  const { data: knowledgeContents } = await supabase
    .from('knowledge_contents')
    .select('id, title, slug, keywords, knowledge_categories!inner(letter)')
    .eq('active', true)

  if (knowledgeContents) {
    for (const content of knowledgeContents) {
      const categoryLetter = (content as any).knowledge_categories?.letter?.toLowerCase() || ''
      if (!categoryLetter) continue
      
      const url = `/base-conhecimento/${categoryLetter}/${content.slug}`
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

  // 3. Buscar documentos técnicos de resinas
  const { data: resinDocuments } = await supabase
    .from('resin_documents')
    .select(`
      id,
      document_name,
      file_url,
      resins!inner(name)
    `)
    .eq('active', true)
  
  // 🚫 REMOVIDO: Busca automática de produtos do catálogo para evitar alucinações
  // Links para produtos devem ser curados manualmente via external_links ou seleção explícita de CTAs
  // Isso evita que a IA adicione links para produtos não mencionados no conteúdo original

  if (resinDocuments) {
    for (const doc of resinDocuments) {
      const resin = (doc as any).resins
      const priority = 70 // Prioridade alta para documentos técnicos
      
      // Usar nome do documento como keyword
      const keywordText = doc.document_name.toLowerCase()
      if (!linkMap.has(keywordText)) {
        linkMap.set(keywordText, {
          id: doc.id,
          url: doc.file_url,
          priority,
          source: 'document'
        })
      }
      
      // Adicionar variações com nome da resina
      const fullKeyword = `${doc.document_name} ${resin.name}`.toLowerCase()
      if (!linkMap.has(fullKeyword)) {
        linkMap.set(fullKeyword, {
          id: doc.id,
          url: doc.file_url,
          priority: priority * 0.9,
          source: 'document'
        })
      }
    }
  }

  console.log(`✅ ${linkMap.size} keywords carregadas (incluindo produtos do catálogo)`)
  
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

  // Detectar URLs no texto bruto
  const urlPattern = /(https?:\/\/[^\s]+)/g
  const detectedUrls = rawText.match(urlPattern) || []
  const urlInstructions = detectedUrls.length > 0 
    ? `\n\n🔗 URLS DETECTADAS NO TEXTO ORIGINAL (preservar como <a> tags):\n${detectedUrls.map(url => `- ${url}`).join('\n')}\n`
    : ''

  // Criar lista de links para o prompt
  const externalLinks = sortedKeywords
    .filter(([_, data]) => data.source === 'external' || data.source === 'knowledge')
    .map(([keyword, data]) => `"${keyword}" -> ${data.url} (prioridade: ${Math.round(data.priority)})`)
    .join('\n')

  const documentLinks = sortedKeywords
    .filter(([_, data]) => data.source === 'document')
    .map(([keyword, data]) => `"${keyword}" -> ${data.url} [DOCUMENTO PDF] (prioridade: ${Math.round(data.priority)})`)
    .join('\n')

const defaultPrompt = `Você é um especialista em SEO moderno, E-E-A-T, copywriting técnico odontológico e formatação profissional de conteúdo para blog.

Receba o texto bruto abaixo e transforme-o em um artigo editorial completo, altamente útil, totalmente otimizado para SEO e estruturado em HTML limpo.

REQUISITOS OBRIGATÓRIOS:

1. TAGS PERMITIDAS
Use SOMENTE:
<h1>, <h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <section>, <figure>

2. ESTRUTURA PADRÃO
- <h1> para o título principal  
- Todo conteúdo dividido em <section class="content-card">  
- Para listas importantes, use <section class="benefit-card">  
- Para chamada final (se aplicável), use <section class="cta-panel">

3. E-E-A-T (O QUE O GOOGLE AMA)
O texto deve ter:
- Clareza técnica
- Tom profissional e didático
- Sentido editorial natural (não robótico)
- Informações precisas do texto original
- Sem invenções, sem dados externos, sem comparações não citadas
- Parágrafos curtos, leitura escaneável

4. SEO MODERNO
- Use palavras-chave naturalmente
- Estruture bem os headings
- Insira links internos automáticos SOMENTE quando o sistema reconhecer a keyword
- Máximo 1 link por seção
- Não criar URLs manualmente
- Não forçar links desnecessários

5. IMAGENS (NARRATIVAS)
Crie trechos onde imagens se encaixariam naturalmente, mas NÃO insira <img>.

6. FAQ (APENAS SE FIZER SENTIDO)
Se o conteúdo justificar, adicione uma seção FAQ ao final com 5 a 10 perguntas curtas.

7. RESTRIÇÕES
- Não invente informações
- Não adicione CTAs se o texto não justificar
- Não utilize outras tags além das permitidas
- Não inclua explicações sobre o processo
- Retorne SOMENTE HTML puro`

  const fullPrompt = `${customPrompt || defaultPrompt}
${urlInstructions}

🔗 LISTA DE LINKS INTERNOS PARA INSERIR AUTOMATICAMENTE:

${externalLinks}

📄 DOCUMENTOS TÉCNICOS (PDFs) DISPONÍVEIS:

${documentLinks}

⚠️ REGRAS DE INSERÇÃO DE LINKS:
1. Insira <a href="URL">palavra-chave</a> quando encontrar as palavras-chave acima
2. Para documentos PDF, use descrições como "veja o documento técnico", "confira o PDF", "download do guia"
3. MÁXIMO 1 link por palavra-chave (primeira ocorrência apenas)
4. MÁXIMO 10-15 links internos por artigo
5. Priorize keywords com maior score de prioridade
6. Links devem ser naturais no contexto
7. Use title="" nos links para acessibilidade
8. Links para PDFs devem abrir em nova aba com target="_blank" rel="noopener"

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

✅ EXEMPLO 3 - CTA (OPCIONAL - apenas se houver contexto relevante):
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

✅ EXEMPLO 5 - PRESERVAR LINKS DO TEXTO ORIGINAL:
Se o texto bruto contém:
"Veja mais em https://exemplo.com/artigo"

Deve retornar:
<p>Veja mais em <a href="https://exemplo.com/artigo" target="_blank" rel="noopener">https://exemplo.com/artigo</a></p>

Ou melhor ainda (se houver contexto):
<p>Veja mais em <a href="https://exemplo.com/artigo" target="_blank" rel="noopener">nosso artigo completo</a></p>

⚠️ REGRAS OBRIGATÓRIAS:
1. SEMPRE use <div class="content-card"> para agrupar conteúdo relacionado
2. Use <div class="grid-benefits"> para listas de benefícios (mínimo 3 cards)
3. Use <div class="grid-3"> para dados/estatísticas (3 colunas fixas)
4. Use <span class="badge"> ou <span class="badge badge-primary"> para categorização
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
          content: SYSTEM_SUPER_PROMPT
        },
        { 
          role: 'user', 
          content: `TAREFA: Formatação HTML + SEO + Links Internos

Você é um especialista em SEO e HTML semântico.

IMPORTANTE:
- Retorne APENAS HTML puro, sem markdown, sem \`\`\`html
- SEMPRE use as classes CSS especificadas (content-card, benefit-card, cta-panel, grid-benefits)
- Insira links internos automaticamente quando encontrar palavras-chave
- Estruture o conteúdo de forma profissional e visualmente atraente
- Use EXATAMENTE as estruturas HTML dos exemplos fornecidos

⚠️ REGRAS CRÍTICAS DE FIDELIDADE AO CONTEÚDO:
1. **NÃO INVENTE INFORMAÇÕES**: Use APENAS dados presentes no texto bruto
2. **NÃO REMOVA INFORMAÇÕES**: Mantenha todas as frases e dados do autor
3. **PRESERVE LINKS ORIGINAIS**: Se o texto tiver URLs (http://, https://), converta para <a href="URL">texto</a>
4. **NÃO ADICIONE DADOS FICTÍCIOS**: Evite estatísticas, nomes de produtos ou citações que não estão no texto original
5. **NÃO INVENTE CHAMADAS PARA AÇÃO (CTAs)**: Apenas adicione <div class="cta-panel"> se o texto original explicitamente mencionar um produto, serviço ou guia para promover. Caso contrário, omita completamente

${fullPrompt}` 
        }
      ],
      temperature: 0.7,
      max_tokens: 8000
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
  const usage = extractUsage(aiData)
  await logAIUsage({
    functionName: "ai-content-formatter",
    actionLabel: "format-content-full",
    model: "google/gemini-2.5-flash",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  })
  let formattedHTML = aiData.choices[0].message.content

  // 🆕 VALIDAÇÃO: Verificar estrutura mínima
  const hasCard = formattedHTML.includes('class="card"')
  const hasGrid3 = formattedHTML.includes('class="grid-3"')
  const hasBenefit = formattedHTML.includes('class="benefit"')
  const hasCTA = formattedHTML.includes('class="cta-panel"')
  const linkCount = (formattedHTML.match(/<a href/g) || []).length
  const h2Count = (formattedHTML.match(/<h2>/g) || []).length
  const hasFigure = formattedHTML.includes('<figure>')

  console.log('✅ HTML validado:', {
    hasCard,
    hasGrid3,
    hasBenefit,
    hasCTA,
    linkCount,
    h2Count,
    hasFigure
  })

  if (!hasCard || linkCount < 5 || h2Count < 2) {
    console.warn('⚠️ HTML gerado com formatação insuficiente')
  }

  console.log(`✅ HTML final: ${linkCount} links, ${h2Count} h2, ${formattedHTML.length} chars`)
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
