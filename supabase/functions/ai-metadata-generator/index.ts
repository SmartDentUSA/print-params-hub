import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetadataRequest {
  title: string;
  contentHTML: string;
  existingSlug?: string;
  existingMetaDesc?: string;
  existingFaqs?: Array<{ question: string; answer: string }>;
  regenerate?: {
    slug?: boolean;
    metaDescription?: boolean;
    faqs?: boolean;
  };
}

interface MetadataResponse {
  slug: string;
  metaDescription: string;
  keywords: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      title,
      contentHTML,
      existingSlug,
      existingMetaDesc,
      existingFaqs,
      regenerate = {}
    } = await req.json() as MetadataRequest;

    if (!title || !contentHTML) {
      return new Response(
        JSON.stringify({ error: 'Title and contentHTML are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Generating metadata for:', { title, regenerate });

    // ===== SLUG GENERATION =====
    let slug = existingSlug || '';
    if (!existingSlug || regenerate.slug) {
      slug = generateSlug(title);
      slug = await ensureUniqueSlug(supabase, slug);
      console.log('✅ Generated slug:', slug);
    }

    // ===== META DESCRIPTION GENERATION =====
    let metaDescription = existingMetaDesc || '';
    if (!existingMetaDesc || regenerate.metaDescription) {
      metaDescription = await generateMetaDescription(lovableApiKey, title, contentHTML);
      console.log('✅ Generated meta description:', metaDescription);
    }

    // ===== KEYWORDS GENERATION =====
    const keywords = await generateKeywords(lovableApiKey, title, contentHTML);
    console.log('✅ Generated keywords:', keywords);

    // ===== FAQS GENERATION =====
    let faqs = existingFaqs || [];
    if (!existingFaqs || existingFaqs.length === 0 || regenerate.faqs) {
      faqs = await generateFAQs(lovableApiKey, title, contentHTML);
      console.log('✅ Generated FAQs:', faqs.length);
    }

    const response: MetadataResponse = {
      slug,
      metaDescription,
      keywords,
      faqs
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error generating metadata:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===== HELPER FUNCTIONS =====

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensureUniqueSlug(supabase: any, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data, error } = await supabase
      .from('knowledge_contents')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking slug uniqueness:', error);
      break;
    }

    if (!data) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

async function generateMetaDescription(
  apiKey: string,
  title: string,
  contentHTML: string
): Promise<string> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 500);

  const prompt = `Você é um especialista em SEO e CTR (Click-Through Rate).

Crie uma meta description altamente persuasiva para o conteúdo abaixo.

Regras obrigatórias:
- Máximo 160 caracteres
- Incluir a palavra-chave principal (o título)
- Responder à intenção de busca
- Tom profissional e claro
- Focado em benefício + propósito
- Sem emojis
- Frase completa, não cortada
- Não inventar dados não presentes no título/conteúdo

Título: ${title}
Conteúdo: ${contentPreview}

Retorne APENAS a meta description, sem aspas ou formatação.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let metaDesc = data.choices[0]?.message?.content?.trim() || '';

  // Remover aspas se existirem
  metaDesc = metaDesc.replace(/^["']|["']$/g, '');

  // Garantir 160 caracteres máximo
  if (metaDesc.length > 160) {
    metaDesc = metaDesc.substring(0, 157) + '...';
  }

  return metaDesc;
}

async function generateKeywords(
  apiKey: string,
  title: string,
  contentHTML: string
): Promise<string[]> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 1000);

  const prompt = `Você é um especialista em SEO e otimização semântica.

Extraia 8 a 12 palavras-chave altamente relevantes baseadas no título e no conteúdo fornecido.

Regras:
- SOMENTE palavras presentes no conteúdo ou semanticamente coerentes
- Misture cauda curta, média e longa
- Inclua termos técnicos odontológicos
- Sem repetições
- Sem palavras em inglês
- Sem termos genéricos ("artigo", "conteúdo", "blog")
- Apenas strings simples
- Retorne SÓ o array de keywords

Título: ${title}
Conteúdo: ${contentPreview}`;

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
    console.error('❌ AI API error for keywords:', errorText);
    // Fallback: retornar array vazio se falhar
    return [];
  }

  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== 'extract_keywords') {
    console.warn('⚠️ Unexpected AI response for keywords, using empty array');
    return [];
  }

  const parsedArgs = JSON.parse(toolCall.function.arguments);
  return parsedArgs.keywords || [];
}

async function generateFAQs(
  apiKey: string,
  title: string,
  contentHTML: string
): Promise<Array<{ question: string; answer: string }>> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentText = stripTags(contentHTML).substring(0, 2000);

  const prompt = `Você é um especialista em conteúdo odontológico e SEO orientado a perguntas frequentes (People Also Ask - Google).

Gere EXATAMENTE 10 FAQs (perguntas e respostas) com base no conteúdo fornecido.

Regras obrigatórias:
- Exatamente 10 perguntas
- Cada resposta: 50 a 150 palavras
- Perguntas naturais, como usuários perguntariam no Google
- Ordem: das mais genéricas às mais específicas
- Usar APENAS informações presentes no conteúdo
- Tom profissional, claro e educativo
- Sem inventar novos dados
- Sem adicionar estatísticas externas
- Entregar no formato especificado via function calling

Título: ${title}
Conteúdo: ${contentText}`;

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
            name: 'generate_faqs',
            description: 'Return 10 FAQs based on the content',
            parameters: {
              type: 'object',
              properties: {
                faqs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      answer: { type: 'string' }
                    },
                    required: ['question', 'answer']
                  },
                  minItems: 10,
                  maxItems: 10
                }
              },
              required: ['faqs']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'generate_faqs' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== 'generate_faqs') {
    console.error('Unexpected AI response format:', data);
    throw new Error('AI did not return FAQs in expected format');
  }

  const parsedArgs = JSON.parse(toolCall.function.arguments);
  const faqs = parsedArgs.faqs || [];

  // Garantir exatamente 10 FAQs
  if (faqs.length < 10) {
    console.warn(`AI returned only ${faqs.length} FAQs, expected 10`);
  }

  return faqs.slice(0, 10);
}
