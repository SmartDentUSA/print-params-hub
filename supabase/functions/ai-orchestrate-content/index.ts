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
  
  // Campos legacy
  sources: ContentSources;
  productId?: string;
  productName?: string;
  language?: 'pt' | 'en' | 'es';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 Iniciando geração orquestrada de conteúdo...');
    
    const { sources, title, excerpt, productId, productName, language = 'pt', aiPrompt }: OrchestrationRequest = await req.json();

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
DADOS DO BANCO DE DADOS (Produtos, Resinas, Parâmetros):
${JSON.stringify(databaseData, null, 2)}

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

<h2 itemscope itemtype="https://schema.org/FAQPage">❓ Perguntas e Respostas com Autoridade</h2>
<div class="content-card">
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Pergunta 1 relevante?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Resposta usando [RÓTULO: VOZ_EAT] e [RÓTULO: PROTOCOLO]. Cite dados técnicos quando relevante.</p>
    </div>
  </div>
  <!-- Gerar exatamente 10 FAQs totais, cobrindo dúvidas técnicas, clínicas e comerciais -->
</div>

<h2>✅ Conclusão e Voz do Especialista</h2>
<blockquote>
  <p>Citação do [RÓTULO: VOZ_EAT] encerrando o artigo com autoridade. Se não houver citação específica, crie uma conclusão técnica que resuma os benefícios validados.</p>
</blockquote>
<div class="cta-panel">
  <h3>💡 Proteja Sua Reputação Clínica</h3>
  <p>Use materiais certificados e siga protocolos validados por especialistas. Invista em odontologia digital de qualidade.</p>
</div>

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

**RETORNE APENAS O ARTIGO COMPLETO FORMATADO EM HTML VÁLIDO.**
**NÃO INCLUA \`\`\`html ou qualquer marcador de código.**
**APENAS O HTML PURO.**
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
        temperature: 0.3,
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
    const generatedHTML = aiData.choices[0].message.content;

    console.log('✅ Artigo orquestrado gerado com sucesso');

    // Extrair schemas estruturados do HTML
    const hasHowToSchema = generatedHTML.includes('itemtype="https://schema.org/HowTo"');
    const hasFAQSchema = generatedHTML.includes('itemtype="https://schema.org/FAQPage"');
    
    const schemas = {
      howTo: hasHowToSchema,
      faqPage: hasFAQSchema
    };

    return new Response(
      JSON.stringify({ 
        html: generatedHTML,
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
