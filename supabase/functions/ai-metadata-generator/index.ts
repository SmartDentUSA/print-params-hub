import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts';

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
  existingTitle?: string;
  existingExcerpt?: string;
  regenerate?: {
    slug?: boolean;
    metaDescription?: boolean;
    faqs?: boolean;
    title?: boolean;
    excerpt?: boolean;
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
  title?: string;
  excerpt?: string;
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
      existingTitle,
      existingExcerpt,
      regenerate = {}
    } = await req.json() as MetadataRequest;

    // Para gerar título, só contentHTML é obrigatório
    if (regenerate.title && !contentHTML) {
      return new Response(
        JSON.stringify({ error: 'ContentHTML is required to generate title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Para outras operações, título e conteúdo são obrigatórios
    if (!regenerate.title && (!title || !contentHTML)) {
      return new Response(
        JSON.stringify({ error: 'Title and contentHTML are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Generating metadata for:', { title, regenerate });

    // ===== PARALELIZAR CHAMADAS PARA LOVABLE AI =====
    const promises: Promise<{ type: string; value: any }>[] = [];

    // Title (se necessário)
    if (regenerate.title) {
      promises.push(
        generateTitle(lovableApiKey, contentHTML).then(t => ({ type: 'title', value: t }))
      );
    }

    // Meta Description (se necessário)
    if (!existingMetaDesc || regenerate.metaDescription) {
      promises.push(
        generateMetaDescription(lovableApiKey, title, contentHTML).then(m => ({ type: 'meta', value: m }))
      );
    }

    // Keywords (sempre gera)
    promises.push(
      generateKeywords(lovableApiKey, title, contentHTML).then(k => ({ type: 'keywords', value: k }))
    );

    // FAQs (se necessário)
    if (!existingFaqs || regenerate.faqs) {
      promises.push(
        generateFAQs(lovableApiKey, title, contentHTML).then(f => ({ type: 'faqs', value: f }))
      );
    }

    // Aguardar todas as promessas em paralelo
    const results = await Promise.allSettled(promises);

    // Processar resultados
    let generatedTitle = existingTitle || title || '';
    let metaDescription = existingMetaDesc || '';
    let keywords: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { type, value } = result.value;
        if (type === 'title') {
          generatedTitle = value;
          console.log('✅ Generated title:', generatedTitle);
        }
        if (type === 'meta') {
          metaDescription = value;
          console.log('✅ Generated meta description:', metaDescription);
        }
        if (type === 'keywords') {
          keywords = value;
          console.log('✅ Generated keywords:', keywords);
        }
      } else {
        console.error('❌ Promise failed:', result.reason);
      }
    }

    // ===== EXCERPT (depende do título) =====
    let excerpt = existingExcerpt || '';
    if (regenerate.excerpt) {
      excerpt = await generateExcerpt(lovableApiKey, generatedTitle, contentHTML);
      console.log('✅ Generated excerpt:', excerpt);
    }

    // ===== SLUG (depende do título) =====
    let slug = existingSlug || '';
    if (!existingSlug || regenerate.slug) {
      const titleForSlug = generatedTitle || title;
      slug = generateSlug(titleForSlug);
      slug = await ensureUniqueSlug(supabase, slug);
      console.log('✅ Generated slug:', slug);
    }

    // FAQs (processando resultado da promessa)
    let faqs = existingFaqs || [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.type === 'faqs') {
        faqs = result.value.value;
        console.log('✅ Generated FAQs:', faqs.length);
      }
    }

    const response: MetadataResponse = {
      slug,
      metaDescription,
      keywords,
      faqs,
      ...(regenerate.title && { title: generatedTitle }),
      ...(regenerate.excerpt && { excerpt })
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

async function generateTitle(
  apiKey: string,
  contentHTML: string
): Promise<string> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 800);

  const prompt = `Você é um especialista em SEO e copywriting para conteúdo odontológico.

Crie um título altamente otimizado para SEO baseado no conteúdo fornecido.

Regras obrigatórias:
- Máximo 60 caracteres
- Incluir palavra-chave principal do conteúdo
- Tom profissional e direto
- Focado em benefício ou solução clara
- Sem emojis
- Sem pontuação excessiva (!, ?, etc)
- Deve despertar curiosidade ou resolver dúvida
- Não inventar dados não presentes no conteúdo

Conteúdo: ${contentPreview}

Retorne APENAS o título, sem aspas ou formatação.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Título SEO\n\n${prompt}` }
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let titleText = data.choices[0]?.message?.content?.trim() || '';

  // Remover aspas se existirem
  titleText = titleText.replace(/^["']|["']$/g, '');

  // Garantir 60 caracteres máximo
  if (titleText.length > 60) {
    titleText = titleText.substring(0, 57) + '...';
  }

  return titleText;
}

async function generateExcerpt(
  apiKey: string,
  title: string,
  contentHTML: string
): Promise<string> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 500);

  const prompt = `Você é um especialista em SEO e copywriting para conteúdo odontológico.

Crie um resumo (excerpt) altamente persuasivo baseado no título e conteúdo fornecidos.

Regras obrigatórias:
- Máximo 160 caracteres
- Incluir palavra-chave principal do título
- Tom profissional e claro
- Focado em despertar interesse para leitura completa
- Sem emojis
- Frase completa, não cortada
- Não inventar dados não presentes no conteúdo
- Deve complementar o título, não repetir

Título: ${title}
Conteúdo: ${contentPreview}

Retorne APENAS o resumo (excerpt), sem aspas ou formatação.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Resumo (Excerpt)\n\n${prompt}` }
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let excerptText = data.choices[0]?.message?.content?.trim() || '';

  // Remover aspas se existirem
  excerptText = excerptText.replace(/^["']|["']$/g, '');

  // Garantir 160 caracteres máximo
  if (excerptText.length > 160) {
    excerptText = excerptText.substring(0, 157) + '...';
  }

  return excerptText;
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
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Meta Description\n\n${prompt}` }
      ],
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
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Extrair Keywords SEO\n\n${prompt}` }
      ],
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
  const contentPreview = stripTags(contentHTML).substring(0, 4000);

  const prompt = `Baseado no título e conteúdo abaixo, gere EXATAMENTE 10 FAQs relevantes para SEO e Voice Search.

Regras obrigatórias:
- Perguntas devem ser naturais, como pessoas pesquisam no Google
- Perguntas em tom conversacional (ex: "A resina X é boa para...?" em vez de "Qual o resultado do teste de...?")
- Respostas completas de 2-4 frases
- Baseado APENAS no conteúdo fornecido (Princípio-Mãe: sem inventar dados)
- Contexto: odontologia digital brasileira
- Sem repetir informações entre FAQs

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
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: prompt }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_faqs',
          description: 'Generate 10 SEO-optimized FAQs',
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
                }
              }
            },
            required: ['faqs']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'generate_faqs' } }
    }),
  });

  if (!response.ok) {
    console.error('❌ AI API error for FAQs');
    return [];
  }

  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall) return [];
  
  const parsedArgs = JSON.parse(toolCall.function.arguments);
  return parsedArgs.faqs || [];
}
