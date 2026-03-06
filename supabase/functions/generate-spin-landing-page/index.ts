// ═══════════════════════════════════════════════════════════════════════════
// GENERATE SPIN LANDING PAGE — AI-powered SPIN Selling landing page generator
// SEO/GEO/E-E-A-T/AI-Ready with full JSON-LD, HowTo, FAQPage
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logAIUsage, extractUsage } from '../_shared/log-ai-usage.ts';
import { buildSpinLandingPagePrompt, MASTER_SYSTEM_PROMPT } from '../_shared/master-system-prompt.ts';
import { buildDocument } from '../template-engine/index.ts';
import { getSiteBaseUrl } from '../_shared/seo-fine-tuning.ts';
import { getDefaultAuthor } from '../_shared/authority-data-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpinLandingPageInput {
  // Product data
  productId?: string;
  productName: string;
  productDescription: string;
  productPrice?: number;
  productSku?: string;
  productImage?: string;
  ctaUrl?: string;

  // SPIN context
  targetAudience: string;
  mainPain: string;           // S — Situation/Problem
  implications: string[];     // I — Implications
  payoff: string;             // N — Need-Payoff

  // SEO
  slug?: string;
  targetKeyword?: string;
  ogImage?: string;
  ratingValue?: number;
  reviewCount?: number;

  // Options
  dryRun?: boolean;
  language?: 'pt-BR' | 'en' | 'es';
}

// ═══════════════════════════════════════════════════════════════════════════
// AI LANDING PAGE CONTENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

async function generateLandingPageContent(input: SpinLandingPageInput): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const prompt = buildSpinLandingPagePrompt({
    productName: input.productName,
    productDescription: input.productDescription,
    targetAudience: input.targetAudience,
    mainPain: input.mainPain,
    implications: input.implications,
    payoff: input.payoff,
    ctaUrl: input.ctaUrl,
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
    functionName: 'generate-spin-landing-page',
    actionLabel: 'generate-lp-html',
    model: 'google/gemini-2.5-flash',
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });

  const content = data.choices?.[0]?.message?.content || '';
  const articleMatch = content.match(/<article[\s\S]*<\/article>/i);
  return articleMatch ? articleMatch[0] : content;
}

// ═══════════════════════════════════════════════════════════════════════════
// FAQ + HOWTO GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

async function generateFAQsAndHowTo(input: SpinLandingPageInput): Promise<{
  faqs: { question: string; answer: string }[];
  howToSteps: { name: string; text: string }[];
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return { faqs: [], howToSteps: [] };

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
          content: `Produto: "${input.productName}"
Público: ${input.targetAudience}
Dor: ${input.mainPain}
Solução: ${input.payoff}

Gere:
1. 4 FAQs técnico-comerciais
2. 4 passos de HowTo (como começar a usar o produto)

JSON exato:
{
  "faqs": [
    {"question": "Pergunta?", "answer": "Resposta."}
  ],
  "howToSteps": [
    {"name": "Nome do passo", "text": "Descrição detalhada do passo."}
  ]
}

Use APENAS informações fornecidas. Não invente dados.`,
        },
      ],
    }),
  });

  if (!response.ok) return { faqs: [], howToSteps: [] };

  try {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { faqs: [], howToSteps: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      faqs: parsed.faqs || [],
      howToSteps: parsed.howToSteps || [],
    };
  } catch {
    return { faqs: [], howToSteps: [] };
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
    const input: SpinLandingPageInput = await req.json();

    if (
      !input.productName ||
      !input.productDescription ||
      !input.targetAudience ||
      !input.mainPain ||
      !input.implications?.length ||
      !input.payoff
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'productName, productDescription, targetAudience, mainPain, implications, payoff are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[generate-spin-lp] Generating LP for: ${input.productName}`);

    // 1. Generate LP HTML content
    const bodyHtml = await generateLandingPageContent(input);
    console.log(`[generate-spin-lp] HTML generated: ${bodyHtml.length} chars`);

    // 2. Generate FAQs and HowTo in parallel
    const { faqs, howToSteps } = await generateFAQsAndHowTo(input);
    console.log(`[generate-spin-lp] FAQs: ${faqs.length}, HowTo steps: ${howToSteps.length}`);

    // 3. Build complete HTML document via template-engine
    const baseUrl = getSiteBaseUrl();
    const keyword = input.targetKeyword || input.mainPain.substring(0, 40);
    const slug = input.slug || generateSlug(`lp-${input.productName}-${keyword}`);
    const canonical = `${baseUrl}/lp/${slug}`;

    const title = `${input.productName} para ${input.targetAudience} | SmartDent`;
    const description = `${input.payoff}. ${input.productDescription.substring(0, 100)}`;

    const { html, stats } = buildDocument({
      title,
      description: description.substring(0, 160),
      slug,
      bodyHtml,
      language: input.language || 'pt-BR',
      canonical,
      ogImage: input.ogImage || input.productImage,
      pageType: 'landing-page',
      productName: input.productName,
      productDescription: input.productDescription,
      productImage: input.productImage,
      productSku: input.productSku,
      productPrice: input.productPrice,
      productCurrency: 'BRL',
      author: getDefaultAuthor(),
      ratingValue: input.ratingValue,
      reviewCount: input.reviewCount,
      faqs,
      howToSteps,
      datePublished: new Date().toISOString().split('T')[0],
      dateModified: new Date().toISOString().split('T')[0],
      geoProductName: input.productName,
      geoCategory: 'odontologia digital',
      breadcrumbs: [
        { name: 'Home', url: baseUrl },
        { name: 'Produtos', url: `${baseUrl}/produtos` },
        { name: input.productName, url: canonical },
      ],
      hreflangEntries: [
        { lang: 'pt-BR', url: canonical },
        { lang: 'en', url: `${baseUrl}/en/lp/${slug}` },
        { lang: 'es', url: `${baseUrl}/es/lp/${slug}` },
      ],
    });

    console.log(`[generate-spin-lp] Document built: ${stats.htmlSizeBytes} bytes, score: ${stats.score}/10`);
    if (stats.warnings.length > 0) {
      console.warn('[generate-spin-lp] Warnings:', stats.warnings);
    }

    // 4. Save to database unless dry run
    let savedId: string | null = null;
    if (!input.dryRun) {
      const { data: saved, error: saveError } = await supabase
        .from('knowledge_contents')
        .upsert(
          {
            title,
            slug,
            excerpt: description.substring(0, 255),
            content_html: html,
            faqs,
            keywords: [
              input.productName,
              keyword,
              input.targetAudience,
              'odontologia digital',
              'impressão 3D odontológica',
            ],
            meta_description: description.substring(0, 155),
            active: true,
            ai_context: `Landing page SPIN Selling para ${input.productName}. Público: ${input.targetAudience}. Score SEO/GEO/E-E-A-T: ${stats.score}/10.`,
            og_image_url: input.ogImage || input.productImage || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();

      if (saveError) {
        console.error('[generate-spin-lp] DB save error:', saveError);
      } else {
        savedId = saved?.id || null;
        console.log(`[generate-spin-lp] Saved with ID: ${savedId}`);
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
    console.error('[generate-spin-lp] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
