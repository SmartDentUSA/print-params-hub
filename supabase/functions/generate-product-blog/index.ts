// ═══════════════════════════════════════════════════════════════════════════
// GENERATE PRODUCT BLOG — AI-powered product blog generator
// SEO/GEO/E-E-A-T/AI-Ready with full JSON-LD and semantic HTML5
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logAIUsage, extractUsage } from '../_shared/log-ai-usage.ts';
import { buildBlogPrompt, MASTER_SYSTEM_PROMPT } from '../_shared/master-system-prompt.ts';
import { buildDocument } from '../template-engine/index.ts';
import { getSiteBaseUrl } from '../_shared/seo-fine-tuning.ts';
import { getDefaultAuthor } from '../_shared/authority-data-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlogGeneratorInput {
  productId?: string;
  productName: string;
  productDescription: string;
  category: string;
  targetKeyword: string;
  relatedKeywords?: string[];
  slug?: string;
  ogImage?: string;
  ratingValue?: number;
  reviewCount?: number;
  faqs?: { question: string; answer: string }[];
  dryRun?: boolean;
  language?: 'pt-BR' | 'en' | 'es';
}

// ═══════════════════════════════════════════════════════════════════════════
// AI CONTENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

async function generateBlogContent(input: BlogGeneratorInput): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const prompt = buildBlogPrompt({
    productName: input.productName,
    productDescription: input.productDescription,
    category: input.category,
    targetKeyword: input.targetKeyword,
    relatedKeywords: input.relatedKeywords,
  });

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: MASTER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: 'generate-product-blog',
    actionLabel: 'generate-blog-html',
    model: 'google/gemini-2.5-flash',
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });

  const content = data.choices?.[0]?.message?.content || '';
  // Extract HTML between <article> tags if present
  const articleMatch = content.match(/<article[\s\S]*<\/article>/i);
  return articleMatch ? articleMatch[0] : content;
}

// ═══════════════════════════════════════════════════════════════════════════
// FAQ GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

async function generateFAQs(
  productName: string,
  productDescription: string
): Promise<{ question: string; answer: string }[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Responda APENAS com JSON válido. Sem texto adicional.' },
        {
          role: 'user',
          content: `Gere 4 perguntas e respostas frequentes sobre o produto "${productName}" para um blog técnico odontológico.
Descrição: ${productDescription.substring(0, 500)}

Formato JSON:
[
  {"question": "Pergunta 1?", "answer": "Resposta detalhada 1."},
  {"question": "Pergunta 2?", "answer": "Resposta detalhada 2."}
]

Use APENAS informações da descrição fornecida. Não invente dados.`,
        },
      ],
    }),
  });

  if (!response.ok) return [];

  try {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SLUG GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HANDLER
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: BlogGeneratorInput = await req.json();

    if (!input.productName || !input.productDescription || !input.category || !input.targetKeyword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'productName, productDescription, category, targetKeyword are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[generate-product-blog] Generating blog for: ${input.productName}`);

    // 1. Generate blog HTML content
    const bodyHtml = await generateBlogContent(input);
    console.log(`[generate-product-blog] HTML generated: ${bodyHtml.length} chars`);

    // 2. Generate FAQs if not provided
    const faqs = input.faqs && input.faqs.length > 0
      ? input.faqs
      : await generateFAQs(input.productName, input.productDescription);

    // 3. Build complete HTML document via template-engine
    const baseUrl = getSiteBaseUrl();
    const slug = input.slug || generateSlug(`blog-${input.productName}-${input.targetKeyword}`);
    const canonical = `${baseUrl}/blog/${slug}`;

    const { html, stats } = buildDocument({
      title: `${input.productName}: ${input.targetKeyword} | SmartDent`,
      description: input.productDescription.substring(0, 155),
      slug,
      bodyHtml,
      language: input.language || 'pt-BR',
      canonical,
      ogImage: input.ogImage,
      pageType: 'blog',
      productName: input.productName,
      productDescription: input.productDescription,
      productImage: input.ogImage,
      author: getDefaultAuthor(),
      ratingValue: input.ratingValue,
      reviewCount: input.reviewCount,
      faqs,
      datePublished: new Date().toISOString().split('T')[0],
      dateModified: new Date().toISOString().split('T')[0],
      geoProductName: input.productName,
      geoCategory: input.category,
      breadcrumbs: [
        { name: 'Home', url: baseUrl },
        { name: 'Blog', url: `${baseUrl}/blog` },
        { name: input.category, url: `${baseUrl}/blog/categoria/${generateSlug(input.category)}` },
        { name: input.productName, url: canonical },
      ],
      hreflangEntries: [
        { lang: 'pt-BR', url: canonical },
        { lang: 'en', url: `${baseUrl}/en/blog/${slug}` },
        { lang: 'es', url: `${baseUrl}/es/blog/${slug}` },
      ],
    });

    console.log(`[generate-product-blog] Document built: ${stats.htmlSizeBytes} bytes, score: ${stats.score}/10`);
    if (stats.warnings.length > 0) {
      console.warn('[generate-product-blog] Warnings:', stats.warnings);
    }

    // 4. Save to database unless dry run
    let savedId: string | null = null;
    if (!input.dryRun) {
      const { data: saved, error: saveError } = await supabase
        .from('knowledge_contents')
        .upsert(
          {
            title: `${input.productName}: ${input.targetKeyword}`,
            slug,
            excerpt: input.productDescription.substring(0, 255),
            content_html: html,
            faqs,
            keywords: [input.targetKeyword, ...(input.relatedKeywords || []), input.productName],
            meta_description: input.productDescription.substring(0, 155),
            active: true,
            ai_context: `Blog técnico sobre ${input.productName} focado em ${input.targetKeyword}. Gerado com SEO/GEO/E-E-A-T score ${stats.score}/10.`,
            og_image_url: input.ogImage || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();

      if (saveError) {
        console.error('[generate-product-blog] DB save error:', saveError);
      } else {
        savedId = saved?.id || null;
        console.log(`[generate-product-blog] Saved with ID: ${savedId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        canonical,
        dryRun: input.dryRun || false,
        savedId,
        stats,
        html: input.dryRun ? html : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-product-blog] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
