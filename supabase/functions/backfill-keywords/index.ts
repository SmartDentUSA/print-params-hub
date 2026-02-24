import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting keywords backfill...');

    // Buscar todos os artigos que não têm keywords
    const { data: articles, error: fetchError } = await supabase
      .from('knowledge_contents')
      .select('id, title, content_html, keywords')
      .or('keywords.is.null,keywords.eq.{}')
      .eq('active', true);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📝 Found ${articles?.length || 0} articles without keywords`);

    let updated = 0;
    let failed = 0;

    for (const article of articles || []) {
      try {
        console.log(`Processing: ${article.title}`);

        const keywords = await generateKeywords(
          lovableApiKey,
          article.title,
          article.content_html || ''
        );

        if (keywords.length > 0) {
          const { error: updateError } = await supabase
            .from('knowledge_contents')
            .update({ keywords })
            .eq('id', article.id);

          if (updateError) {
            console.error(`❌ Failed to update ${article.title}:`, updateError);
            failed++;
          } else {
            console.log(`✅ Updated ${article.title} with ${keywords.length} keywords`);
            updated++;
          }
        } else {
          console.warn(`⚠️ No keywords generated for ${article.title}`);
          failed++;
        }

        // Rate limiting: esperar 1 segundo entre chamadas
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing ${article.title}:`, error);
        failed++;
      }
    }

    const result = {
      success: true,
      total: articles?.length || 0,
      updated,
      failed,
      message: `Backfill completed: ${updated} updated, ${failed} failed`
    };

    console.log('🎉 Backfill completed:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateKeywords(
  apiKey: string,
  title: string,
  contentHTML: string
): Promise<string[]> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 1000);

  const prompt = `Você é um especialista em SEO. Extraia 8-12 palavras-chave relevantes para o seguinte conteúdo:

Título: ${title}
Conteúdo: ${contentPreview}

Regras:
- Palavras-chave relacionadas ao tema principal
- Inclua termos técnicos e específicos da área odontológica
- Misture palavras-chave de cauda curta e longa
- Sem repetições
- Apenas palavras-chave em português
- Formato: array de strings simples`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_keywords',
            description: 'Extract relevant SEO keywords',
            parameters: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 8,
                  maxItems: 12
                }
              },
              required: ['keywords']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'extract_keywords' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== 'extract_keywords') {
    throw new Error('AI did not return keywords in expected format');
  }

  const parsedArgs = JSON.parse(toolCall.function.arguments);
  return parsedArgs.keywords || [];
}
