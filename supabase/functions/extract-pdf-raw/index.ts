import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, linkedProduct } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'pdfBase64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📄 Iniciando extração PURA de PDF...');
    console.log('📦 Produto vinculado:', linkedProduct?.name || 'Não especificado');

    // Construir contexto do produto vinculado (se existir)
    let productContext = '';
    if (linkedProduct) {
      const productName = linkedProduct.name || 'Não especificado';
      const manufacturer = linkedProduct.manufacturer || linkedProduct.category || 'Não especificado';
      productContext = `
CONTEXTO DO PRODUTO VINCULADO (apenas para referência - NÃO invente informações sobre este produto):
- Produto: ${productName}
- Fabricante/Categoria: ${manufacturer}

Este documento pertence a este produto. Use essas informações apenas como contexto, mas transcreva LITERALMENTE o que está no PDF.`;
    }

    const systemPrompt = `Você é um TRANSCRITOR LITERAL de documentos PDF técnicos.

REGRAS ABSOLUTAS E INVIOLÁVEIS:

1. TRANSCREVA LITERALMENTE o conteúdo do PDF - palavra por palavra
2. NÃO invente, complete, deduza ou "melhore" NADA
3. Se algo estiver ilegível, escreva: "[ilegível]"
4. Se algo estiver incompleto ou cortado, escreva: "[incompleto no original]"
5. NÃO adicione seções, títulos ou informações que não existam no documento
6. NÃO mencione outros produtos além dos que estão escritos no documento
7. NÃO adicione seções como "Produtos Relacionados" ou "Recomendações"
8. Preserve a estrutura EXATA do documento (títulos, listas, tabelas, ordem)
9. Se o documento for um estudo técnico, transcreva APENAS esse estudo
10. Use Markdown para formatar, mantendo a hierarquia original

O QUE VOCÊ DEVE FAZER:
- Transcrever títulos exatamente como aparecem
- Manter listas na mesma ordem
- Preservar tabelas no formato Markdown
- Manter numeração de seções se existir
- Transcrever textos de figuras/gráficos se visíveis

O QUE VOCÊ NUNCA DEVE FAZER:
- Adicionar introduções ou conclusões não presentes
- Criar resumos ou sínteses
- Mencionar produtos que não estão no documento
- Inventar dados técnicos, especificações ou resultados
- Adicionar links ou referências externas
- Completar informações "faltantes"
${productContext}`;

    const userPrompt = `Transcreva LITERALMENTE o conteúdo deste documento PDF.

LEMBRE-SE: 
- Apenas transcrição literal
- Zero invenção de dados
- Se não está no PDF, não adicione`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_completion_tokens: 16000,
        temperature: 0.1 // Baixa temperatura para máxima fidelidade
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', errorText);
      throw new Error(`Erro na API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }

    // Verificar se a IA adicionou seções suspeitas (anti-hallucination check)
    const suspiciousSections = [
      '## 🛒 Produtos Relacionados',
      '## Produtos Relacionados',
      '## Recomendações',
      '### Atos Resina',
      'PERCLASE®' // Se o produto vinculado não é PERCLASE, isso é alucinação
    ];

    let hasHallucination = false;
    for (const section of suspiciousSections) {
      // Só marca como alucinação se mencionar produtos que não são o vinculado
      if (section.includes('Produtos Relacionados') && extractedText.includes(section)) {
        console.warn('⚠️ Possível alucinação detectada: seção de produtos relacionados');
        hasHallucination = true;
      }
    }

    const tokensUsed = data.usage?.total_tokens || Math.ceil(extractedText.length / 4);

    console.log('✅ Extração concluída');
    console.log(`📊 Tokens usados: ${tokensUsed}`);
    console.log(`📝 Caracteres extraídos: ${extractedText.length}`);
    if (hasHallucination) {
      console.warn('⚠️ ALERTA: Possível conteúdo alucinado detectado');
    }

    return new Response(
      JSON.stringify({
        extractedText,
        tokensUsed,
        hasHallucination,
        linkedProduct: linkedProduct?.name || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em extract-pdf-raw:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
