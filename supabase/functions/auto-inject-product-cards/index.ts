import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductMatch {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  description: string | null;
  shop_url: string;
  processing_instructions?: string;
}

interface InjectionReport {
  articleId: string;
  articleTitle: string;
  detectedProducts: number;
  cardsInjected: number;
  productsLinked: string[];
  resinsLinked: string[];
  status: 'success' | 'error';
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { articleId, batchProcess } = await req.json();

    if (batchProcess) {
      // Processar todos os artigos
      const { data: articles, error: articlesError } = await supabase
        .from('knowledge_contents')
        .select('id, title, content_html')
        .eq('active', true)
        .not('content_html', 'is', null);

      if (articlesError) throw articlesError;

      const reports: InjectionReport[] = [];
      
      for (const article of articles || []) {
        const report = await processArticle(supabase, article.id, article.title, article.content_html);
        reports.push(report);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          reports,
          totalArticles: reports.length,
          totalCardsInjected: reports.reduce((sum, r) => sum + r.cardsInjected, 0)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (articleId) {
      // Processar artigo específico
      const { data: article, error: articleError } = await supabase
        .from('knowledge_contents')
        .select('id, title, content_html')
        .eq('id', articleId)
        .single();

      if (articleError) throw articleError;

      const report = await processArticle(supabase, article.id, article.title, article.content_html);

      return new Response(
        JSON.stringify({ success: true, report }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Forneça articleId ou batchProcess=true');
    }
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processArticle(
  supabase: any,
  articleId: string,
  articleTitle: string,
  contentHtml: string
): Promise<InjectionReport> {
  try {
    console.log(`📝 Processando: ${articleTitle}`);

    // 1. Buscar produtos e resinas do catálogo
    const [productsResult, resinsResult] = await Promise.all([
      supabase
        .from('system_a_catalog')
        .select('id, name, slug, image_url, price, currency, rating, description, cta_1_url')
        .eq('active', true)
        .eq('approved', true),
      supabase
        .from('resins')
        .select('id, name, slug, image_url, description, system_a_product_url, processing_instructions')
        .eq('active', true)
    ]);

    if (productsResult.error) throw productsResult.error;
    if (resinsResult.error) throw resinsResult.error;

    const products = productsResult.data || [];
    const resins = resinsResult.data || [];

    // 2. Detectar menções no HTML
    const detectedProducts: ProductMatch[] = [];
    const detectedResins: ProductMatch[] = [];

    // Detectar produtos do catálogo
    for (const product of products) {
      const nameRegex = new RegExp(escapeRegex(product.name), 'gi');
      if (nameRegex.test(contentHtml)) {
        detectedProducts.push({
          id: product.id,
          name: product.name,
          slug: product.slug,
          image_url: product.image_url,
          price: product.price,
          currency: product.currency,
          rating: product.rating,
          description: product.description,
          shop_url: product.cta_1_url || product.slug || '#'
        });
      }
    }

    // Detectar resinas com variações de nome
    for (const resin of resins) {
      let detected = false;
      
      // Criar variações do nome para melhor detecção
      const nameVariations = [
        resin.name,
        resin.name.replace(/\b(Bio|Pro|Plus|Max|Premium)\b/gi, '').trim(), // Remove palavras comuns
        resin.name.split(' ').slice(0, 2).join(' '), // Primeiras 2 palavras
      ];
      
      // Testar cada variação
      for (const variation of nameVariations) {
        if (variation.length < 3) continue; // Skip variações muito curtas
        
        const nameRegex = new RegExp(escapeRegex(variation), 'gi');
        if (nameRegex.test(contentHtml)) {
          detected = true;
          break;
        }
      }
      
      if (detected) {
        detectedResins.push({
          id: resin.id,
          name: resin.name,
          slug: resin.slug,
          image_url: resin.image_url,
          price: null,
          currency: null,
          rating: null,
          description: resin.description,
          shop_url: resin.system_a_product_url || `/resinas/${resin.slug}` || '#',
          processing_instructions: resin.processing_instructions
        });
      }
    }

    console.log(`✅ Detectados: ${detectedProducts.length} produtos, ${detectedResins.length} resinas`);

    // 3. Injetar cards no HTML
    let modifiedHtml = contentHtml;
    let cardsInjected = 0;

    const allDetected = [...detectedProducts, ...detectedResins];
    
    for (const item of allDetected) {
      // Evitar duplicatas - verificar se já tem card
      if (modifiedHtml.includes(`data-product-card="${item.id}"`)) {
        continue;
      }

      const cardHtml = generateCardHtml(item);
      
      // Procurar primeira menção do produto
      const firstMentionRegex = new RegExp(escapeRegex(item.name), 'i');
      const match = firstMentionRegex.exec(modifiedHtml);
      
      if (match) {
        // Encontrar o fim do parágrafo após a menção
        const mentionIndex = match.index;
        const paragraphEndIndex = modifiedHtml.indexOf('</p>', mentionIndex);
        
        if (paragraphEndIndex !== -1) {
          // Inserir card após o parágrafo
          modifiedHtml = 
            modifiedHtml.slice(0, paragraphEndIndex + 4) + 
            '\n\n' + cardHtml + '\n\n' +
            modifiedHtml.slice(paragraphEndIndex + 4);
          
          cardsInjected++;
        }
      }
    }

    // 4. Atualizar artigo no banco
    const { error: updateError } = await supabase
      .from('knowledge_contents')
      .update({
        content_html: modifiedHtml,
        recommended_products: detectedProducts.map(p => p.id),
        recommended_resins: detectedResins.map(r => r.slug),
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId);

    if (updateError) throw updateError;

    console.log(`✅ ${cardsInjected} cards injetados`);

    return {
      articleId,
      articleTitle,
      detectedProducts: allDetected.length,
      cardsInjected,
      productsLinked: detectedProducts.map(p => p.name),
      resinsLinked: detectedResins.map(r => r.name),
      status: 'success'
    };
  } catch (error: any) {
    console.error(`❌ Erro ao processar ${articleTitle}:`, error);
    return {
      articleId,
      articleTitle,
      detectedProducts: 0,
      cardsInjected: 0,
      productsLinked: [],
      resinsLinked: [],
      status: 'error',
      error: error.message
    };
  }
}

function generateCardHtml(product: ProductMatch): string {
  const priceHtml = product.price 
    ? `<span class="card-price">${product.currency || 'R$'} ${product.price.toFixed(2).replace('.', ',')}</span>`
    : '';
  
  const ratingHtml = product.rating
    ? `<span class="card-rating"><svg class="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${product.rating.toFixed(1)}/5</span>`
    : '';

  const descriptionHtml = product.description
    ? `<p class="card-description">${truncate(product.description, 120)}</p>`
    : '';

  const processingHtml = product.processing_instructions
    ? `
      <div class="card-processing">
        <div class="card-processing-title">⚙️ Instruções de Processamento</div>
        <div class="card-processing-content">${product.processing_instructions.replace(/\n/g, '<br>')}</div>
      </div>
    `
    : '';

  const imageHtml = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" loading="lazy" class="card-image" />`
    : '';

  return `
<div class="inline-product-card" data-product-card="${product.id}">
  <a href="${product.shop_url}" target="_blank" rel="noopener noreferrer" class="card-link">
    <div class="card-container">
      ${imageHtml}
      <div class="card-content">
        <div class="card-badge">📦 Produto Recomendado</div>
        <h4 class="card-title">${product.name}</h4>
        ${descriptionHtml}
        ${processingHtml}
        <div class="card-meta">
          ${ratingHtml}
          ${priceHtml}
        </div>
        <button class="card-cta">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          Ver na Loja
        </button>
      </div>
    </div>
  </a>
</div>`.trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}
