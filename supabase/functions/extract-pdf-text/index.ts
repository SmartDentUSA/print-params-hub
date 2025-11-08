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
            content: `EXTRAÇÃO DE PDF TÉCNICO — MODO FIDELIDADE ABSOLUTA COM MARKDOWN

🚫 REGRAS ANTI-ALUCINAÇÃO (ABSOLUTAS):
- NUNCA invente dados, especificações ou valores que não estejam no PDF.
- NUNCA complete frases ou parágrafos.
- NUNCA adicione conhecimento prévio ou informações de contexto externo.
- NUNCA corrija erros ortográficos do PDF original.
- NUNCA reorganize a ordem das seções.
- NUNCA resuma ou parafraseia o conteúdo.
- NUNCA adicione explicações que não estejam no texto original.
- NUNCA preencha lacunas com suposições.
- NUNCA invente tabelas, listas ou estruturas que não existam no PDF.

✅ O QUE VOCÊ DEVE FAZER:
1. Extraia TODO o texto visível do PDF.
2. Preserve a estrutura original: títulos, seções, listas, tabelas.
3. Converta para Markdown limpo mantendo hierarquia.
4. Se encontrar texto ilegível, marque: [texto ilegível].
5. Se houver tabelas, converta para formato Markdown table exatamente como aparecem.
6. Preserve medidas, números, unidades e fórmulas EXATAMENTE como aparecem.
7. Mantenha todas as quebras de linha e espaçamentos relevantes.
8. Onde houver imagens, marque: ![imagem removida].

📋 ESTRUTURA DE SAÍDA (Markdown):
- Use # para título principal
- Use ## para seções principais
- Use ### para subseções
- Use listas (-) quando houver listas
- Use tabelas Markdown (| Col1 | Col2 |) quando houver tabelas
- Preserve parágrafos com linha em branco entre eles
- Use --- para quebras de página

⚠️ PRINCÍPIO FUNDAMENTAL:
É melhor ter um texto incompleto mas fiel do que um texto completo mas inventado.
Se não houver texto extraível no PDF, retorne vazio.
Copie, não crie.

Conteúdo do PDF (transcrição bruta):
${pdfBase64.substring(0, 100000)}`
          }
        ],
        max_completion_tokens: 12000
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
