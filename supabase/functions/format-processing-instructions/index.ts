import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um formatador de instruções técnicas de processamento de resinas 3D para impressão odontológica.

ENTRADA: Texto bruto com instruções de processamento (pode vir de PDF, e-mail, anotações, ou qualquer formato).
SAÍDA: O MESMO conteúdo reorganizado em Markdown estruturado. Retorne APENAS o texto formatado, sem explicações.

REGRAS OBRIGATÓRIAS:

1. SEÇÕES PRINCIPAIS — use ## (com espaço após):
   - ## PRÉ-PROCESSAMENTO
   - ## PÓS-PROCESSAMENTO
   - ## Pós-cura UV
   - ## Tratamento térmico complementar
   - Outras seções relevantes identificadas no texto

2. SUBSEÇÕES — use ### (com espaço após):
   - Ex: ### Lavagem e limpeza — [NanoClean Pod]
   - Ex: ### Secagem com ar comprimido
   - Produtos/equipamentos mencionados devem ficar entre colchetes [ ]

3. BULLETS — use • para cada instrução/passo:
   - Cada passo em uma linha separada com •
   - Sub-itens com 2 espaços de indentação + •
   - Ex:
     • Equipamentos desktop wash & cure
       • Elegoo Mercury – 36 W
         • Facetas: 8 min

4. NOTAS/ALERTAS — use > para informações importantes:
   - Avisos de segurança, temperaturas críticas, observações técnicas
   - Ex: > A superfície deve apresentar aspecto opaco e seco antes da pós-cura

5. PROIBIÇÕES:
   - NÃO invente conteúdo. Apenas reorganize o que foi fornecido.
   - NÃO altere valores numéricos (temperaturas, tempos, pressões, distâncias).
   - NÃO adicione passos que não existam no texto original.
   - NÃO remova informações do texto original.
   - Preserve unidades de medida exatamente como estão (µm, °C, psi, min, s, cm, W).

6. Se o texto já contiver marcadores ## ou ###, reorganize-os no formato correto.
7. Se o texto não tiver separação clara entre pré e pós, use seu julgamento para categorizar, mas NUNCA invente passos.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Texto muito curto ou ausente. Cole as instruções de processamento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`📝 Formatando instruções de processamento (${text.length} chars)...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Formate o seguinte texto de instruções de processamento:\n\n${text}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI formatting failed: ${errorText}`);
    }

    const data = await response.json();
    const usage = extractUsage(data);
    await logAIUsage({
      functionName: "format-processing-instructions",
      actionLabel: "format-instructions",
      model: "google/gemini-3-flash-preview",
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
    let formatted = data.choices?.[0]?.message?.content || '';

    // Remove code fences if present
    formatted = formatted.trim();
    if (formatted.startsWith('```markdown')) {
      formatted = formatted.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
    } else if (formatted.startsWith('```')) {
      formatted = formatted.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    console.log(`✅ Formatação concluída (${formatted.length} chars)`);

    return new Response(
      JSON.stringify({ formatted: formatted.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao formatar instruções' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
