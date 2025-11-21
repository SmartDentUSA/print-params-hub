import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SYSTEM_SUPER_PROMPT } from "../_shared/system-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentSources {
  // Campos novos (frontend atual)
  rawText?: string;
  pdfTranscription?: string;
  videoTranscription?: string;
  relatedPdfs?: Array<{ name: string; content: string }>;
  
  // Campos legacy (retrocompatibilidade)
  technicalSheet?: string;
  transcript?: string;
  manual?: string;
  testimonials?: string;
  customPrompt?: string;
}

interface OrchestrationRequest {
  // Novos campos
  title?: string;
  excerpt?: string;
  activeSources?: Record<string, boolean>;
  aiPrompt?: string;
  selectedResinIds?: string[];
  selectedProductIds?: string[];
  expansionWarning?: boolean; // ✅ NOVO: Flag para ajustar temperatura
  
  // Campos legacy
  sources: ContentSources;
  productId?: string;
  productName?: string;
  language?: 'pt' | 'en' | 'es';
}

interface OrchestratorResponse {
  html: string;
  faqs: Array<{ question: string; answer: string }>;
  metadata: {
    educationalLevel: string;
    learningResourceType: string;
    timeRequired: string;
    proficiencyLevel: string;
    teaches: string[];
    aiContext: string;
  };
  schemas: {
    howTo: boolean;
    faqPage: boolean;
  };
  success: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 Iniciando geração orquestrada de conteúdo...');
    
    const { 
      sources, 
      title, 
      excerpt, 
      productId, 
      productName, 
      language = 'pt', 
      aiPrompt,
      selectedResinIds = [],
      selectedProductIds = [],
      expansionWarning = false // ✅ NOVO
    }: OrchestrationRequest = await req.json();

    // Validar se há pelo menos uma fonte (suporta ambos formatos)
    const hasAnySources = 
      (sources.rawText && sources.rawText.trim().length > 0) ||
      (sources.pdfTranscription && sources.pdfTranscription.trim().length > 0) ||
      (sources.videoTranscription && sources.videoTranscription.trim().length > 0) ||
      (sources.relatedPdfs && sources.relatedPdfs.length > 0) ||
      Object.values(sources).some(source => typeof source === 'string' && source && source.trim().length > 0);
      
    if (!hasAnySources) {
      throw new Error('É necessário fornecer pelo menos uma fonte de conteúdo');
    }

    // Buscar dados complementares do banco de dados
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 Buscando dados complementares do banco...');
    
    let databaseData: any = {
      products: [],
      resins: [],
      parameters: [],
      articles: []
    };

    try {
      // Buscar produtos relacionados
      const { data: products } = await supabase
        .from('system_a_catalog')
        .select('*')
        .eq('active', true)
        .limit(20);
      
      // Buscar resinas
      const { data: resins } = await supabase
        .from('resins')
        .select('*')
        .eq('active', true)
        .limit(20);
      
      // Buscar parâmetros de impressão
      const { data: parameters } = await supabase
        .from('parameter_sets')
        .select('*')
        .eq('active', true)
        .limit(20);
      
      // Buscar artigos relacionados
      const { data: articles } = await supabase
        .from('knowledge_contents')
        .select('title, slug, excerpt')
        .eq('active', true)
        .limit(10);

      databaseData = {
        products: products || [],
        resins: resins || [],
        parameters: parameters || [],
        articles: articles || []
      };

      console.log(`✅ Dados obtidos: ${products?.length || 0} produtos, ${resins?.length || 0} resinas, ${parameters?.length || 0} parâmetros`);
    } catch (error) {
      console.error('⚠️ Erro ao buscar dados complementares:', error);
      // Continua mesmo se falhar a busca de dados complementares
    }

    // 🎯 ENRIQUECIMENTO VIA CTAs: Buscar dados detalhados dos produtos selecionados
    let detailedProductsContext = '';
    
    if (selectedResinIds.length > 0 || selectedProductIds.length > 0) {
      console.log(`🔍 Buscando dados detalhados de ${selectedResinIds.length} resinas e ${selectedProductIds.length} produtos selecionados...`);
      
      const detailedProducts = [];
      
      // Buscar resinas selecionadas com documentos
      if (selectedResinIds.length > 0) {
        const { data: selectedResins } = await supabase
          .from('resins')
          .select(`
            id, name, manufacturer, type, description, price, color,
            cta_1_label, cta_1_url, cta_2_label, cta_2_url,
            system_a_product_url
          `)
          .in('id', selectedResinIds);

        // Buscar documentos técnicos das resinas
        for (const resin of selectedResins || []) {
          const { data: docs } = await supabase
            .from('resin_documents')
            .select('extracted_text, document_name')
            .eq('resin_id', resin.id)
            .eq('active', true)
            .limit(2);

          detailedProducts.push({
            type: 'resin',
            ...resin,
            technicalDocs: docs?.map(d => ({
              name: d.document_name,
              text: d.extracted_text?.substring(0, 1500)
            }))
          });
        }
      }

      // Buscar produtos selecionados com documentos
      if (selectedProductIds.length > 0) {
        const { data: selectedProducts } = await supabase
          .from('system_a_catalog')
          .select(`
            id, name, category, description, price, image_url,
            cta_1_label, cta_1_url, cta_2_label, cta_2_url,
            product_category, product_subcategory
          `)
          .in('id', selectedProductIds);

        // Buscar documentos técnicos dos produtos
        for (const product of selectedProducts || []) {
          const { data: docs } = await supabase
            .from('catalog_documents')
            .select('extracted_text, document_name')
            .eq('product_id', product.id)
            .eq('active', true)
            .limit(2);

          // Buscar artigos relacionados
          const { data: relatedArticles } = await supabase
            .from('knowledge_contents')
            .select('title, slug')
            .contains('recommended_products', [product.id])
            .eq('active', true)
            .limit(3);

          detailedProducts.push({
            type: 'product',
            ...product,
            technicalDocs: docs?.map(d => ({
              name: d.document_name,
              text: d.extracted_text?.substring(0, 1500)
            })),
            relatedArticles: relatedArticles?.map(a => ({ title: a.title, slug: a.slug }))
          });
        }
      }

      // Montar contexto enriquecido com SISTEMA DE PRIORIDADE
      if (detailedProducts.length > 0) {
        detailedProductsContext = `

═══════════════════════════════════════════════════════════
🎯 PRODUTOS PRIORITÁRIOS (SELECIONADOS PARA DESTAQUE COMERCIAL)
═══════════════════════════════════════════════════════════

${detailedProducts.map(item => `
━━━ ${item.name} (${item.manufacturer || item.category}) ━━━

📋 DADOS TÉCNICOS:
${item.description || 'Sem descrição'}

${item.technicalDocs?.length > 0 ? `
📄 ESPECIFICAÇÕES COMPLETAS:
${item.technicalDocs.map(doc => `
  • ${doc.name}:
  ${doc.text || 'Documento sem texto extraído'}
`).join('\n')}
` : ''}

💰 DADOS COMERCIAIS:
- Preço: ${item.price ? `R$ ${item.price}` : 'Consultar'}
- URL de compra: ${item.cta_1_url || item.system_a_product_url || 'Consultar'}

${item.relatedArticles?.length > 0 ? `
🔗 ARTIGOS RELACIONADOS:
${item.relatedArticles.map(a => `- ${a.title} (/base-conhecimento/${a.slug})`).join('\n')}
` : ''}

`).join('\n')}

═══════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES CRÍTICAS DE PRIORIZAÇÃO
═══════════════════════════════════════════════════════════

1️⃣ PRIORIDADE MÁXIMA (OBRIGATÓRIO):
   - Criar seções dedicadas e detalhadas para cada produto acima
   - Incluir todas as especificações técnicas listadas
   - Mencionar preços e links de compra quando disponíveis
   - Adicionar CTAs naturais ao longo do texto
   - Dar mais destaque (mais texto, mais detalhes) a estes produtos

2️⃣ PRIORIDADE SECUNDÁRIA (PERMITIDO):
   - Se as fontes de conteúdo (PDFs, vídeos, textos) mencionarem outros produtos/soluções, você PODE citá-los
   - Mas mantenha essas menções mais breves e contextuais
   - Não forneça especificações completas de produtos não listados acima
   - Não adicione CTAs para produtos não listados

3️⃣ PROIBIDO (NUNCA FAÇA):
   - Inventar produtos que não existem
   - Criar especificações técnicas não fornecidas
   - Mencionar preços de produtos não listados acima
   - Citar estudos ou dados não presentes nas fontes

OBJETIVO: Criar um artigo completo e educacional que reflete fielmente as fontes fornecidas, mas com foco comercial estratégico nos produtos prioritários listados acima.
`;
        console.log(`✅ Contexto enriquecido gerado com ${detailedProducts.length} itens`);
      }
    }

    // Buscar links externos para internal linking
    const { data: externalLinks } = await supabase
      .from('external_links')
      .select('name, url')
      .eq('approved', true)
      .limit(50);

    const keywordsWithUrls = (externalLinks || [])
      .map(link => `- **${link.name}**: ${link.url}`)
      .join('\n');

    // Construir prompt orquestrador
    let ORCHESTRATOR_PROMPT = `${SYSTEM_SUPER_PROMPT}\n\n`;

    ORCHESTRATOR_PROMPT += `**FUNÇÃO CENTRAL: ORQUESTRADOR DE CONTEÚDO SEMÂNTICO MULTI-FONTE**\n\n`;
    ORCHESTRATOR_PROMPT += `Você é o Gerente Editorial de Conteúdo da SmartDent. Sua missão é criar um único artigo técnico-comercial a partir de fontes de dados heterogêneas.\n\n`;

    if (title) {
      ORCHESTRATOR_PROMPT += `## TÍTULO DO ARTIGO:\n${title}\n\n`;
    }

    if (excerpt) {
      ORCHESTRATOR_PROMPT += `## RESUMO/EXCERPT:\n${excerpt}\n\n`;
    }

    ORCHESTRATOR_PROMPT += `**DADOS DE ENTRADA:**\n\n`;

    // Processar rawText (texto colado manualmente)
    if (sources.rawText) {
      ORCHESTRATOR_PROMPT += `### 📝 TEXTO BRUTO (colado manualmente):\n${sources.rawText}\n\n`;
    }

    // Processar pdfTranscription (PDF enviado pelo usuário)
    if (sources.pdfTranscription) {
      ORCHESTRATOR_PROMPT += `### 📄 TRANSCRIÇÃO DE PDF:\n${sources.pdfTranscription}\n\n`;
    }

    // Processar videoTranscription
    if (sources.videoTranscription) {
      ORCHESTRATOR_PROMPT += `### 🎬 TRANSCRIÇÃO DE VÍDEO:\n${sources.videoTranscription}\n\n`;
    }

    // Processar relatedPdfs (PDFs da base de conhecimento)
    if (sources.relatedPdfs && sources.relatedPdfs.length > 0) {
      ORCHESTRATOR_PROMPT += `### 📚 PDFs DA BASE DE CONHECIMENTO:\n\n`;
      sources.relatedPdfs.forEach((pdf, index) => {
        ORCHESTRATOR_PROMPT += `#### PDF ${index + 1}: ${pdf.name}\n${pdf.content}\n\n`;
      });
    }

    // Retrocompatibilidade: campos legacy
    if (sources.technicalSheet) {
      ORCHESTRATOR_PROMPT += `### FICHA TÉCNICA (legacy):\n${sources.technicalSheet}\n\n`;
    }

    if (sources.transcript) {
      ORCHESTRATOR_PROMPT += `### TRANSCRIÇÃO (legacy):\n${sources.transcript}\n\n`;
    }

    if (sources.manual) {
      ORCHESTRATOR_PROMPT += `### MANUAL DO FABRICANTE (legacy):\n${sources.manual}\n\n`;
    }

    if (sources.testimonials) {
      ORCHESTRATOR_PROMPT += `### DEPOIMENTOS DE ESPECIALISTAS (legacy):\n${sources.testimonials}\n\n`;
    }

    ORCHESTRATOR_PROMPT += `
📊 DADOS DO BANCO (use quando relevante):

${detailedProductsContext || `
Produtos disponíveis no catálogo:
${databaseData.products?.map((p: any) => `- ${p.name} (${p.category}) - R$ ${p.price || 'Consulte'}`).join('\n') || 'Nenhum produto encontrado'}

Resinas disponíveis:
${databaseData.resins?.map((r: any) => `- ${r.name} (${r.manufacturer}) - Tipo: ${r.type}`).join('\n') || 'Nenhuma resina encontrada'}

Parâmetros de impressão disponíveis:
${databaseData.parameters?.map((p: any) => `- ${p.brand_slug} ${p.model_slug}: ${p.resin_manufacturer} ${p.resin_name} (Layer: ${p.layer_height}mm, Cure: ${p.cure_time}s, Light: ${p.light_intensity}%)`).join('\n') || 'Nenhum parâmetro encontrado'}
`}

LISTA DE KEYWORDS COM URLS PARA INTERNAL LINKING:
${keywordsWithUrls}


**ESTRUTURA DE RÓTULOS SEMÂNTICOS (Mapeamento Interno):**
Antes de gerar o artigo, identifique e marque mentalmente os trechos com as seguintes tags:
* **[RÓTULO: DADO_TECNICO]**: Dados brutos (MPa, ISO, % Carga, valores de teste).
* **[RÓTULO: PROTOCOLO]**: Sequências de ação, passos numerados, tempos (s/min), instruções de uso.
* **[RÓTULO: VOZ_EAT]**: Citações diretas de Professores, Universidades, Conclusões de Especialistas.
* **[RÓTULO: POSICIONAMENTO]**: Frases sobre manuseio, diferenciais de mercado, apelo à reputação.

**ORDEM DE PRIORIDADE E COERÊNCIA:**
1.  **COESÃO:** O artigo final deve soar como uma única peça escrita, e não como uma colagem de textos.
2.  **PRECISÃO:** NUNCA invente ou combine dados técnicos de forma incorreta. Mantenha a fidelidade absoluta aos números.
3.  **AUTORIDADE:** A Voz E-E-A-T deve ser integrada nas seções de "Desempenho" e na "Conclusão".
4.  **HOWTO/FAQ:** Todos os trechos [RÓTULO: PROTOCOLO] devem gerar a seção HowTo. Todos os trechos [RÓTULO: POSICIONAMENTO] devem gerar o FAQ.

**ESTRUTURA DE SAÍDA FINAL (Artigo Único para Publicação):**

<h1>${productName ? `O Guia Completo de ${productName}` : 'Guia Técnico Completo'}: [TÍTULO OTIMIZADO PARA SEO]</h1>
<div class="content-card">
  <p>Introdução coesa, usando o [RÓTULO: POSICIONAMENTO]. Estabeleça contexto e relevância do produto/tópico.</p>
</div>

<h2>🔬 A Ciência por Trás: Composição e Desempenho</h2>
<div class="grid-3">
  <div class="benefit-card">
    <h3>[VALOR MPa ou métrica principal]</h3>
    <p>Resistência à flexão / Principal propriedade</p>
  </div>
  <div class="benefit-card">
    <h3>[VALOR 2]</h3>
    <p>Segunda propriedade técnica</p>
  </div>
  <div class="benefit-card">
    <h3>[VALOR 3]</h3>
    <p>Terceira propriedade técnica</p>
  </div>
</div>
<div class="content-card">
  <p>Explicação detalhada dos dados técnicos do [RÓTULO: DADO_TECNICO], sempre citando as normas (ISO, ASTM) quando disponíveis.</p>
  
  <table>
    <thead>
      <tr><th>Propriedade</th><th>Valor</th><th>Norma</th></tr>
    </thead>
    <tbody>
      <!-- Tabela de composição e propriedades técnicas -->
    </tbody>
  </table>
</div>

<h2 itemscope itemtype="https://schema.org/HowTo">📋 Protocolo Clínico Detalhado para Máximo Sucesso</h2>
<div class="content-card">
  <p><strong>Materiais necessários:</strong> [Lista de materiais do protocolo]</p>
  
  <ol>
    <li itemprop="step" itemscope itemtype="https://schema.org/HowToStep">
      <span itemprop="name"><strong>Passo 1:</strong> [Nome do passo]</span>
      <span itemprop="text">[Descrição detalhada] (Tempo: Xs)</span>
  </li>
    <!-- Lista ordenada completa do [RÓTULO: PROTOCOLO] -->
  </ol>
  
  <div class="cta-panel">
    <p>⚠️ <strong>Importante:</strong> Sempre siga as recomendações do fabricante e as normas de biossegurança.</p>
  </div>
</div>

<h2>✅ Conclusão e Voz do Especialista</h2>
<blockquote>
  <p>Citação do [RÓTULO: VOZ_EAT] encerrando o artigo com autoridade. Se não houver citação específica, crie uma conclusão técnica que resuma os benefícios validados.</p>
</blockquote>
<div class="cta-panel">
  <h3>💡 Proteja Sua Reputação Clínica</h3>
  <p>Use materiais certificados e siga protocolos validados por especialistas. Invista em odontologia digital de qualidade.</p>
</div>

  </article>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "Título do procedimento",
    "step": []
  }
  </script>

[RÓTULO: CONCLUSAO_VOZ_EAT]

${aiPrompt ? `
**INSTRUÇÕES ADICIONAIS DO USUÁRIO:**
${aiPrompt}

` : sources.customPrompt ? `
**INSTRUÇÕES ADICIONAIS (legacy):**
${sources.customPrompt}

` : ''}
**CRITICAL INTERNAL LINKING:**
- Sempre que mencionar keywords da lista fornecida, adicione links internos usando: <a href="URL" class="internal-link">Texto Âncora</a>
- Priorize 5-10 links internos naturalmente distribuídos pelo texto
- Use variações naturais do texto âncora (não repita sempre o mesmo)

═══════════════════════════════════════════════════════════
⚙️ SCHEMAS AVANÇADOS OBRIGATÓRIOS (SEO + IA REGENERATIVA 2025)
═══════════════════════════════════════════════════════════

1️⃣ LearningResource Schema (inclua nos metadados):
   - educationalLevel: "professional" (para dentistas/protéticos) ou "expert" (para especialistas)
   - learningResourceType: "how-to" (tutoriais) ou "reference" (fichas técnicas)
   - timeRequired: estimativa em minutos de leitura (ex: "PT15M" para 15 minutos)

2️⃣ TechArticle Schema:
   - proficiencyLevel: "Expert" ou "Intermediate"
   - teaches: lista de conceitos/habilidades ensinados

3️⃣ AI-context (para ChatGPT/Perplexity/Google SGE):
   
   **METODOLOGIA SPIN (Situação → Problema → Implicação → Necessidade-Solução):**
   
   Gerar um pitch CONSULTIVO (não descritivo) de 80-120 palavras que:
   
   a) **Situação:** Contextualize o cenário do profissional (ex: "cirurgiões-dentistas que trabalham com próteses digitais")
   
   b) **Problema:** Identifique a dor específica (ex: "enfrentam 90% de falhas em impressões 3D por parâmetros incorretos")
   
   c) **Implicação:** Quantifique o impacto (ex: "gerando custos de retrabalho de R$ 2.000/mês e perda de confiança do paciente")
   
   d) **Necessidade-Solução:** Apresente o conteúdo como solução (ex: "Este guia técnico ensina o protocolo validado para configurar...")
   
   **Tom:** Consultivo, focado em benefício mensurável
   **Dados:** Sempre cite números técnicos reais (resistência MPa, temperatura, tempo, custos)
   **Público:** Profissional buscando solução para problema específico
   
   **Exemplo de AI-Context SPIN:**
   "Descubra como cirurgiões-dentistas estão eliminando 90% das falhas em próteses digitais 
   configurando parâmetros específicos de impressão 3D. Este guia técnico ensina o protocolo 
   validado para resinas cerâmicas de alta resistência (>80 MPa), reduzindo custos de retrabalho 
   em até R$ 2.000/mês. Inclui checklist de pré-impressão e análise de 12 casos clínicos."

**FORMATO DE RESPOSTA OBRIGATÓRIO:**

Você DEVE retornar um objeto JSON válido com esta estrutura exata:

{
  "html": "<!-- Artigo HTML completo SEM a seção de FAQs -->",
  "faqs": [
    {
      "question": "Pergunta 1?",
      "answer": "Resposta detalhada com dados técnicos..."
    },
    {
      "question": "Pergunta 2?",
      "answer": "Resposta detalhada..."
    }
    // Gerar exatamente 10 FAQs
  ],
  "metadata": {
    "educationalLevel": "professional",
    "learningResourceType": "how-to",
    "timeRequired": "PT15M",
    "proficiencyLevel": "Expert",
    "teaches": ["impressão 3D odontológica", "configuração de parâmetros", "workflow digital"],
    "aiContext": "Conteúdo técnico-científico sobre impressão 3D odontológica..."
  }
}

**REGRAS CRÍTICAS:**
1. Retorne APENAS o JSON válido (sem \`\`\`json ou outros marcadores)
2. O campo "html" NÃO deve conter a seção <h2>❓ Perguntas e Respostas</h2>
3. O campo "faqs" deve conter array com exatamente 10 perguntas e respostas
4. As FAQs devem cobrir: 5 técnicas, 3 clínicas, 2 comerciais
5. As respostas devem usar dados técnicos quando relevante e ter entre 50-150 palavras
6. Seja extremamente técnico nos dados do HTML (resistência, módulo, temperatura, etc.)
7. Cite produtos e resinas prioritários do contexto enriquecido quando relevante
8. Use [RÓTULO] para separar blocos de conteúdo semântico no HTML
9. O campo "metadata" é OBRIGATÓRIO e deve incluir todos os campos listados acima
`;

    console.log('🤖 Chamando IA para gerar artigo orquestrado...');

    // Chamar Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: ORCHESTRATOR_PROMPT }
        ],
        max_completion_tokens: 12000,
        // ✅ NOVO: Temperatura dinâmica baseada em expansionWarning
        temperature: expansionWarning ? 0.1 : 0.3, // Reduz criatividade se alto risco
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro na API de IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de taxa excedido. Tente novamente em alguns instantes.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Por favor, adicione créditos à sua workspace Lovable AI.');
      }
      
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices[0].message.content;

    console.log('🔍 Parseando resposta da IA...');

    let parsedResponse: { html: string; faqs: Array<{ question: string; answer: string }> };

    try {
      parsedResponse = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('⚠️ Erro ao parsear JSON, tentando limpeza...', parseError);
      
      // Limpeza progressiva
      let cleanedContent = rawContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Extrair apenas o JSON válido
      const jsonStart = cleanedContent.indexOf('{');
      const jsonEnd = cleanedContent.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
      }
      
      try {
        parsedResponse = JSON.parse(cleanedContent);
        console.log('✅ JSON parseado com sucesso após limpeza');
      } catch (secondError) {
        console.error('❌ Falha total no parse do JSON:', secondError);
        console.error('📄 Primeiros 500 chars:', rawContent.substring(0, 500));
        throw new Error('IA não retornou JSON válido. Tente novamente.');
      }
    }

    // Validar estrutura da resposta
    if (!parsedResponse.html || !Array.isArray(parsedResponse.faqs)) {
      console.error('❌ Resposta inválida:', parsedResponse);
      throw new Error('IA retornou estrutura inválida (falta html ou faqs)');
    }

    if (parsedResponse.faqs.length === 0) {
      console.warn('⚠️ Nenhuma FAQ gerada pela IA');
    }

    const generatedHTML = parsedResponse.html;
    const generatedFAQs = parsedResponse.faqs;

    console.log(`✅ Artigo orquestrado gerado: ${generatedHTML.length} chars, ${generatedFAQs.length} FAQs\n`);

    // Extrair schemas estruturados do HTML (HowTo ainda está no HTML)
    const hasHowToSchema = generatedHTML.includes('itemtype="https://schema.org/HowTo"');

    const schemas = {
      howTo: hasHowToSchema,
      faqPage: generatedFAQs.length > 0 // FAQ existe se temos FAQs separadas
    };

    return new Response(
      JSON.stringify({ 
        html: generatedHTML,
        faqs: generatedFAQs,
        metadata: parsedResponse.metadata || {
          educationalLevel: 'professional',
          learningResourceType: 'how-to',
          timeRequired: 'PT10M',
          proficiencyLevel: 'Expert',
          teaches: [],
          aiContext: ''
        },
        schemas,
        success: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na função ai-orchestrate-content:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
