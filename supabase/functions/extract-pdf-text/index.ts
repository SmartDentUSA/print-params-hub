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
            content: `Você irá receber o conteúdo extraído de um PDF técnico.
Sua tarefa é reconstruir a apostila com fidelidade máxima, preservando toda a estrutura textual original, incluindo:

- títulos e subtítulos
- hierarquia de seções (Níveis 1, 2, 3, etc.)
- listas numeradas e com marcadores
- tabelas (recriar em Markdown com todas as colunas)
- blocos de código ou comandos
- citações e chamadas de atenção
- notas de rodapé (converter para seção "Notas")
- formatação como negrito, itálico e corpo monoespaçado quando aplicável
- fórmulas simples em formato textual
- separadores, divisões e seções internas

⚠️ IMPORTANTE:
- Não incluir imagens
- Onde houver imagem no PDF, escrever apenas: ![imagem removida]
- Nunca inventar conteúdo
- Nunca resumir
- Nunca reescrever
- A saída deve ser 100% texto, estruturada em Markdown limpo

✅ REGRAS DE PRECISÃO:
- Não alterar palavras do PDF
- Não compactar parágrafos
- Recriar tabelas com | colunas | alinhamento |
- Não mover conteúdo entre seções
- Recriar exatamente o fluxo do PDF, apenas removendo imagens
- Quebras de página devem virar: ---
- Evitar caracteres fantasmas (ex: \\u200B, \\f, etc)
- Se existir sumário, reproduzir como texto normal

✅ FORMATO FINAL:
O resultado deve ser devolvido em Markdown puro seguindo a estrutura original do documento.

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
