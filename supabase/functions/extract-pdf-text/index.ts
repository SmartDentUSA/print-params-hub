import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF base64 data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Etapa 1/2: Limpando e organizando texto do PDF...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
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
            content: `TAREFA: Limpeza e reconstrução de conteúdo técnico odontológico extraído de PDF

Você receberá o texto bruto extraído de um PDF, contendo:
- repetições excessivas de palavras
- termos soltos ("N", "SPLINT", sílabas quebradas)
- erros de OCR
- frases incompletas
- quebras de linha desordenadas
- trechos duplicados
- fragmentos fora de contexto

Sua tarefa:

1. RECONSTRUIR O CONTEÚDO REAL DO DOCUMENTO
- Remova ruídos, repetições, palavras soltas e linhas desconexas
- Recombine frases quebradas
- Reorganize blocos seguindo a lógica técnica do documento
- Mantenha SOMENTE informações reais presentes no PDF
- Não adicione, invente ou complete informações

2. ORGANIZAR EM SEÇÕES COERENTES
Use sempre esta ordem:
• Descrição do produto  
• Ação e funcionamento  
• Indicações e aplicações  
• Vantagens  
• Protocolo de uso  
• Parâmetros de fotopolimerização  
• Testes e resultados  
• Cuidados e contraindicações  
• Durabilidade e desempenho  
• Sustentabilidade e descarte  

3. ESTILO DO TEXTO FINAL
- Totalmente limpo e coerente
- Linguagem técnica, clara e objetiva
- Sem HTML
- Sem Markdown
- Sem formatação visual
- Sem opinião ou interpretação
- Sem resumir excessivamente
- Apenas o conteúdo real, reconstruído e organizado

Retorne SOMENTE o texto limpo e organizado, pronto para o próximo estágio.

Conteúdo do PDF (transcrição bruta):
${pdfBase64.substring(0, 100000)}`
          }
        ],
        max_tokens: 12000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos Lovable AI esgotados. Adicione créditos em Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao processar PDF. Verifique se o arquivo não está corrompido.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;

    if (!extractedText) {
      console.error('No text extracted from AI response');
      return new Response(
        JSON.stringify({ error: 'Não foi possível extrair texto do PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Texto limpo extraído:', extractedText.length, 'caracteres');

    return new Response(
      JSON.stringify({ extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
