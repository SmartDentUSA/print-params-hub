import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_SUPER_PROMPT } from '../_shared/system-prompt.ts';
import { logAIUsage, extractUsage } from '../_shared/log-ai-usage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface AIResult<T> {
  value: T;
  usage: { prompt_tokens: number; completion_tokens: number };
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

    if (regenerate.title && !contentHTML) {
      return new Response(
        JSON.stringify({ error: 'ContentHTML is required to generate title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!regenerate.title && (!title || !contentHTML)) {
      return new Response(
        JSON.stringify({ error: 'Title and contentHTML are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Generating metadata for:', { title, regenerate });

    const promises: Promise<{ type: string; result: AIResult<any> }>[] = [];

    // Title
    if (regenerate.title) {
      promises.push(
        generateTitle(lovableApiKey, contentHTML).then(r => ({ type: 'title', result: r }))
      );
    }

    // Meta Description
    if (!existingMetaDesc || regenerate.metaDescription) {
      promises.push(
        generateMetaDescription(lovableApiKey, title, contentHTML).then(r => ({ type: 'meta', result: r }))
      );
    }

    // Keywords
    promises.push(
      generateKeywords(lovableApiKey, title, contentHTML).then(r => ({ type: 'keywords', result: r }))
    );

    // FAQs
    if (!existingFaqs || regenerate.faqs) {
      promises.push(
        generateFAQs(lovableApiKey, title, contentHTML).then(r => ({ type: 'faqs', result: r }))
      );
    }

    const results = await Promise.allSettled(promises);

    let generatedTitle = existingTitle || title || '';
    let metaDescription = existingMetaDesc || '';
    let keywords: string[] = [];
    let faqs = existingFaqs || [];
    
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { type, result: aiRes } = result.value;
        totalPromptTokens += aiRes.usage.prompt_tokens;
        totalCompletionTokens += aiRes.usage.completion_tokens;

        if (type === 'title') {
          generatedTitle = aiRes.value;
          console.log('✅ Generated title:', generatedTitle);
        }
        if (type === 'meta') {
          metaDescription = aiRes.value;
          console.log('✅ Generated meta description:', metaDescription);
        }
        if (type === 'keywords') {
          keywords = aiRes.value;
          console.log('✅ Generated keywords:', keywords);
        }
        if (type === 'faqs') {
          faqs = [...faqs, ...aiRes.value];
          console.log('✅ Generated FAQs (appended):', faqs.length);
        }
      } else {
        console.error('❌ Promise failed:', result.reason);
      }
    }

    // Excerpt
    let excerpt = existingExcerpt || '';
    if (regenerate.excerpt) {
      const excerptRes = await generateExcerpt(lovableApiKey, generatedTitle, contentHTML);
      excerpt = excerptRes.value;
      totalPromptTokens += excerptRes.usage.prompt_tokens;
      totalCompletionTokens += excerptRes.usage.completion_tokens;
      console.log('✅ Generated excerpt:', excerpt);
    }

    // Slug
    let slug = existingSlug || '';
    if (!existingSlug || regenerate.slug) {
      const titleForSlug = generatedTitle || title;
      slug = generateSlug(titleForSlug);
      slug = await ensureUniqueSlug(supabase, slug);
      console.log('✅ Generated slug:', slug);
    }

    // Log total usage
    if (totalPromptTokens > 0) {
      await logAIUsage({
        functionName: "ai-metadata-generator",
        actionLabel: `metadata-generation`,
        model: "google/gemini-2.5-flash",
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        metadata: { regenerate },
      });
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

async function generateTitle(apiKey: string, contentHTML: string): Promise<AIResult<string>> {
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Título SEO\n\n${prompt}` }
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  let titleText = data.choices[0]?.message?.content?.trim() || '';
  titleText = titleText.replace(/^["']|["']$/g, '');
  if (titleText.length > 60) titleText = titleText.substring(0, 57) + '...';
  
  return { value: titleText, usage: extractUsage(data) };
}

async function generateExcerpt(apiKey: string, title: string, contentHTML: string): Promise<AIResult<string>> {
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Resumo (Excerpt)\n\n${prompt}` }
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  let excerptText = data.choices[0]?.message?.content?.trim() || '';
  excerptText = excerptText.replace(/^["']|["']$/g, '');
  if (excerptText.length > 160) excerptText = excerptText.substring(0, 157) + '...';

  return { value: excerptText, usage: extractUsage(data) };
}

async function generateMetaDescription(apiKey: string, title: string, contentHTML: string): Promise<AIResult<string>> {
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar Meta Description\n\n${prompt}` }
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  let metaDesc = data.choices[0]?.message?.content?.trim() || '';
  metaDesc = metaDesc.replace(/^["']|["']$/g, '');
  if (metaDesc.length > 160) metaDesc = metaDesc.substring(0, 157) + '...';

  return { value: metaDesc, usage: extractUsage(data) };
}

async function generateKeywords(apiKey: string, title: string, contentHTML: string): Promise<AIResult<string[]>> {
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

  if (!response.ok) return { value: [], usage: { prompt_tokens: 0, completion_tokens: 0 } };
  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];
  const parsedArgs = toolCall ? JSON.parse(toolCall.function.arguments) : {};
  return { value: parsedArgs.keywords || [], usage: extractUsage(data) };
}

async function generateFAQs(apiKey: string, title: string, contentHTML: string): Promise<AIResult<Array<{question: string; answer: string}>>> {
  const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const contentPreview = stripTags(contentHTML).substring(0, 1000);

  const prompt = `Você é um especialista em conteúdo educacional odontológico.
Crie 3 a 5 perguntas frequentes (FAQs) baseadas no conteúdo fornecido.
Regras:
- Perguntas diretas e relevantes para o público-alvo (dentistas/técnicos)
- Respostas curtas e objetivas (máx 2 frases)
- Baseado APENAS no conteúdo fornecido
Título: ${title}
Conteúdo: ${contentPreview}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_SUPER_PROMPT },
        { role: 'user', content: `TAREFA: Gerar FAQs\n\n${prompt}` }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_faqs',
            description: 'Generate frequently asked questions',
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
                  minItems: 3,
                  maxItems: 5
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

  if (!response.ok) return { value: [], usage: { prompt_tokens: 0, completion_tokens: 0 } };
  const data = await response.json();
  const toolCall = data.choices[0]?.message?.tool_calls?.[0];
  const parsedArgs = toolCall ? JSON.parse(toolCall.function.arguments) : {};
  return { value: parsedArgs.faqs || [], usage: extractUsage(data) };
}