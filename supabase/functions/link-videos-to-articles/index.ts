import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkResult {
  method: string;
  linked: number;
  skipped: number;
  videoIds: string[];
}

// ========================================
// STOPWORDS - Palavras genéricas a ignorar
// ========================================
const STOPWORDS = new Set([
  // Nome da empresa / genéricos
  'smart', 'dent', 'dental', 'alpha', 'beta', 'pro', 'plus', 'max', 'ultra',
  // Termos de vídeo/curso
  'curso', 'aula', 'video', 'vídeo', 'tutorial', 'online', 'live', 'webinar',
  // Termos genéricos de odonto
  'odontologia', 'odonto', 'dentista', 'clinica', 'clínica', 'tratamento',
  // Ações genéricas  
  'como', 'fazer', 'usar', 'utilizar', 'aplicar', 'dicas', 'passo',
  // Artigos e preposições
  'para', 'com', 'sem', 'sobre', 'entre', 'antes', 'depois', 'novo', 'nova',
  // Números e quantificadores
  'parte', 'capitulo', 'módulo', 'modulo', 'episodio', 'episódio',
  // Outros genéricos
  'impressora', 'impressao', 'impressão', 'resina', 'material', 'digital',
  'depoimento', 'entrevista', 'cliente', 'resultado', 'caso', 'casos',
]);

// Palavras que indicam vídeos genéricos (não técnicos)
const GENERIC_VIDEO_INDICATORS = [
  'depoimento', 'entrevista', 'cliente', 'feedback', 'opinião', 'opiniao',
  'review', 'unboxing', 'abertura', 'propaganda', 'comercial', 'ad',
];

/**
 * Verifica se uma palavra é significativa (não é stopword e tem tamanho mínimo)
 */
function isSignificantWord(word: string, minLength = 5): boolean {
  const normalized = word.toLowerCase().trim();
  return normalized.length >= minLength && !STOPWORDS.has(normalized);
}

/**
 * Extrai palavras significativas de um texto
 */
function getSignificantWords(text: string, minLength = 5): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_,.:;!?()[\]{}'"]+/)
    .filter(w => isSignificantWord(w, minLength));
}

/**
 * Verifica se um vídeo é "genérico" (depoimento, entrevista, etc)
 */
function isGenericVideo(title: string): boolean {
  const titleLower = title.toLowerCase();
  return GENERIC_VIDEO_INDICATORS.some(indicator => titleLower.includes(indicator));
}

/**
 * Calcula similaridade entre dois conjuntos de palavras significativas
 */
function calculateWordOverlap(words1: string[], words2: string[]): number {
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  const matches = words2.filter(w => set1.has(w));
  return matches.length / Math.min(words1.length, words2.length);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? true; // Default to DRY RUN for safety
    const forceRelink = body.forceRelink || false;

    console.log('🔗 Starting intelligent video-to-article linking (v2.0 - Strict Mode)...');
    console.log(`   Mode: ${dryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}, Force Relink: ${forceRelink}`);
    console.log(`   Stopwords loaded: ${STOPWORDS.size} words`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: LinkResult[] = [];
    let totalLinked = 0;

    // ========================================
    // STEP 1: Match by Product ID (Score 100)
    // Video has product_id -> Article has it in recommended_products
    // MOST RELIABLE - Keep as-is
    // ========================================
    console.log('\n📊 STEP 1: Matching by product_id (highest confidence)...');
    
    const { data: videosWithProduct } = await supabase
      .from('knowledge_videos')
      .select('id, product_id, title')
      .not('product_id', 'is', null)
      .filter(forceRelink ? 'id' : 'content_id', 'is', null);

    const productMatches: string[] = [];
    let productSkipped = 0;
    
    if (videosWithProduct && videosWithProduct.length > 0) {
      for (const video of videosWithProduct) {
        const { data: articles } = await supabase
          .from('knowledge_contents')
          .select('id, title')
          .eq('active', true)
          .contains('recommended_products', [video.product_id]);

        if (articles && articles.length > 0) {
          const article = articles[0];
          console.log(`   ✅ Video "${video.title}" -> Article "${article.title}" (product match)`);
          
          if (!dryRun) {
            await supabase
              .from('knowledge_videos')
              .update({ content_id: article.id })
              .eq('id', video.id);
          }
          productMatches.push(video.id);
        }
      }
    }
    
    results.push({ method: 'product_match', linked: productMatches.length, skipped: productSkipped, videoIds: productMatches });
    totalLinked += productMatches.length;
    console.log(`   Result: ${productMatches.length} videos linked by product`);

    // ========================================
    // STEP 2: Match by Resin ID (Score 90)
    // Video has resin_id -> Article has it in recommended_resins
    // RELIABLE - Keep as-is
    // ========================================
    console.log('\n📊 STEP 2: Matching by resin_id (high confidence)...');
    
    const { data: videosWithResin } = await supabase
      .from('knowledge_videos')
      .select('id, resin_id, title')
      .not('resin_id', 'is', null)
      .is('content_id', null);

    const resinMatches: string[] = [];
    let resinSkipped = 0;
    
    if (videosWithResin && videosWithResin.length > 0) {
      for (const video of videosWithResin) {
        const { data: articles } = await supabase
          .from('knowledge_contents')
          .select('id, title')
          .eq('active', true)
          .contains('recommended_resins', [video.resin_id]);

        if (articles && articles.length > 0) {
          const article = articles[0];
          console.log(`   ✅ Video "${video.title}" -> Article "${article.title}" (resin match)`);
          
          if (!dryRun) {
            await supabase
              .from('knowledge_videos')
              .update({ content_id: article.id })
              .eq('id', video.id);
          }
          resinMatches.push(video.id);
        }
      }
    }
    
    results.push({ method: 'resin_match', linked: resinMatches.length, skipped: resinSkipped, videoIds: resinMatches });
    totalLinked += resinMatches.length;
    console.log(`   Result: ${resinMatches.length} videos linked by resin`);

    // ========================================
    // STEP 3: Match by Category + Title Similarity (Score 70)
    // IMPROVED: Now requires BOTH category match AND title word overlap
    // ========================================
    console.log('\n📊 STEP 3: Matching by category + title similarity...');
    
    const { data: videosWithCategory } = await supabase
      .from('knowledge_videos')
      .select('id, product_category, title')
      .not('product_category', 'is', null)
      .is('content_id', null);

    const categoryMatches: string[] = [];
    let categorySkipped = 0;
    
    const { data: categories } = await supabase
      .from('knowledge_categories')
      .select('id, name, letter');

    if (videosWithCategory && videosWithCategory.length > 0 && categories) {
      for (const video of videosWithCategory) {
        // Skip generic videos
        if (isGenericVideo(video.title)) {
          console.log(`   ⏭️ Skipped generic video: "${video.title}"`);
          categorySkipped++;
          continue;
        }

        const matchingCat = categories.find(cat => 
          cat.name.toLowerCase().includes(video.product_category!.toLowerCase()) ||
          video.product_category!.toLowerCase().includes(cat.name.toLowerCase())
        );

        if (matchingCat) {
          // Get ALL articles in this category, not just the first one
          const { data: articles } = await supabase
            .from('knowledge_contents')
            .select('id, title')
            .eq('category_id', matchingCat.id)
            .eq('active', true);

          if (articles && articles.length > 0) {
            // Find best matching article by title similarity
            const videoWords = getSignificantWords(video.title);
            let bestMatch: { article: typeof articles[0]; overlap: number } | null = null;

            for (const article of articles) {
              const articleWords = getSignificantWords(article.title);
              const overlap = calculateWordOverlap(videoWords, articleWords);
              
              // Require at least 40% word overlap AND at least 1 significant word match
              if (overlap >= 0.4 && videoWords.some(vw => articleWords.includes(vw))) {
                if (!bestMatch || overlap > bestMatch.overlap) {
                  bestMatch = { article, overlap };
                }
              }
            }

            if (bestMatch) {
              console.log(`   ✅ Video "${video.title}" -> Article "${bestMatch.article.title}" (category + ${(bestMatch.overlap * 100).toFixed(0)}% title match)`);
              
              if (!dryRun) {
                await supabase
                  .from('knowledge_videos')
                  .update({ content_id: bestMatch.article.id })
                  .eq('id', video.id);
              }
              categoryMatches.push(video.id);
            } else {
              console.log(`   ⏭️ Category match but no title similarity: "${video.title}" (cat: ${matchingCat.name})`);
              categorySkipped++;
            }
          }
        }
      }
    }
    
    results.push({ method: 'category_title_match', linked: categoryMatches.length, skipped: categorySkipped, videoIds: categoryMatches });
    totalLinked += categoryMatches.length;
    console.log(`   Result: ${categoryMatches.length} videos linked, ${categorySkipped} skipped`);

    // ========================================
    // STEP 4: Match by Keyword Similarity (Score 60)
    // IMPROVED: Require significant (non-stopword) keyword match
    // ========================================
    console.log('\n📊 STEP 4: Matching by keyword similarity (strict)...');
    
    const { data: unlinkedVideos } = await supabase
      .from('knowledge_videos')
      .select('id, title')
      .is('content_id', null)
      .not('title', 'is', null)
      .limit(200);

    const keywordMatches: string[] = [];
    let keywordSkipped = 0;
    
    if (unlinkedVideos && unlinkedVideos.length > 0) {
      const { data: articlesWithKeywords } = await supabase
        .from('knowledge_contents')
        .select('id, title, keywords')
        .eq('active', true)
        .not('keywords', 'is', null);

      if (articlesWithKeywords) {
        for (const video of unlinkedVideos) {
          // Skip generic videos
          if (isGenericVideo(video.title)) {
            keywordSkipped++;
            continue;
          }

          const videoTitleLower = video.title.toLowerCase();
          const videoSignificantWords = getSignificantWords(video.title);
          let bestMatch: { articleId: string; score: number; articleTitle: string; matchedKeyword: string } | null = null;

          for (const article of articlesWithKeywords) {
            if (!article.keywords || article.keywords.length === 0) continue;

            for (const keyword of article.keywords) {
              const keywordLower = keyword.toLowerCase().trim();
              
              // Only consider keywords with significant words
              const keywordSignificantWords = getSignificantWords(keyword);
              if (keywordSignificantWords.length === 0) continue;
              
              let matchScore = 0;
              
              // Full keyword in title
              if (videoTitleLower.includes(keywordLower) && keywordLower.length >= 6) {
                matchScore = 0.95;
              } else if (keywordSignificantWords.length > 0) {
                // Check significant word overlap
                const matchedWords = keywordSignificantWords.filter(kw => videoTitleLower.includes(kw));
                if (matchedWords.length > 0) {
                  const overlap = matchedWords.length / keywordSignificantWords.length;
                  if (overlap >= 0.5) {
                    matchScore = 0.7 + (overlap * 0.2);
                  }
                }
              }

              if (matchScore > 0 && (!bestMatch || matchScore > bestMatch.score)) {
                bestMatch = { 
                  articleId: article.id, 
                  score: matchScore, 
                  articleTitle: article.title,
                  matchedKeyword: keyword
                };
              }
            }
          }

          // Stricter threshold: 0.75 instead of 0.7
          if (bestMatch && bestMatch.score >= 0.75) {
            console.log(`   ✅ Video "${video.title}" -> Article "${bestMatch.articleTitle}" (keyword: "${bestMatch.matchedKeyword}", score: ${bestMatch.score.toFixed(2)})`);
            
            if (!dryRun) {
              await supabase
                .from('knowledge_videos')
                .update({ content_id: bestMatch.articleId })
                .eq('id', video.id);
            }
            keywordMatches.push(video.id);
          }
        }
      }
    }
    
    results.push({ method: 'keyword_similarity', linked: keywordMatches.length, skipped: keywordSkipped, videoIds: keywordMatches });
    totalLinked += keywordMatches.length;
    console.log(`   Result: ${keywordMatches.length} videos linked, ${keywordSkipped} skipped`);

    // ========================================
    // STEP 5: Match by Transcript (Score 50)
    // IMPROVED: Require SPECIFIC words, ignore stopwords, higher threshold
    // ========================================
    console.log('\n📊 STEP 5: Matching by transcript search (strict)...');
    
    const { data: videosWithTranscript } = await supabase
      .from('knowledge_videos')
      .select('id, title, video_transcript')
      .is('content_id', null)
      .not('video_transcript', 'is', null)
      .limit(100);

    const transcriptMatches: string[] = [];
    let transcriptSkipped = 0;
    
    if (videosWithTranscript && videosWithTranscript.length > 0) {
      const { data: allArticles } = await supabase
        .from('knowledge_contents')
        .select('id, title')
        .eq('active', true);

      if (allArticles) {
        for (const video of videosWithTranscript) {
          // Skip generic videos
          if (isGenericVideo(video.title)) {
            transcriptSkipped++;
            continue;
          }

          const transcriptLower = video.video_transcript!.toLowerCase();
          let bestMatch: { article: typeof allArticles[0]; score: number; matchedWords: string[] } | null = null;
          
          for (const article of allArticles) {
            // Get only SIGNIFICANT words from article title (ignore stopwords)
            const articleSignificantWords = getSignificantWords(article.title, 6); // Min 6 chars
            
            if (articleSignificantWords.length === 0) continue;
            
            // Count how many significant words appear in transcript
            const matchedWords = articleSignificantWords.filter(word => transcriptLower.includes(word));
            const matchRatio = matchedWords.length / articleSignificantWords.length;

            // Stricter threshold: 75% AND at least 2 significant words must match
            if (matchRatio >= 0.75 && matchedWords.length >= 2) {
              if (!bestMatch || matchRatio > bestMatch.score) {
                bestMatch = { article, score: matchRatio, matchedWords };
              }
            }
          }

          if (bestMatch) {
            console.log(`   ✅ Video "${video.title}" -> Article "${bestMatch.article.title}" (transcript: ${(bestMatch.score * 100).toFixed(0)}%, words: ${bestMatch.matchedWords.join(', ')})`);
            
            if (!dryRun) {
              await supabase
                .from('knowledge_videos')
                .update({ content_id: bestMatch.article.id })
                .eq('id', video.id);
            }
            transcriptMatches.push(video.id);
          }
        }
      }
    }
    
    results.push({ method: 'transcript_search', linked: transcriptMatches.length, skipped: transcriptSkipped, videoIds: transcriptMatches });
    totalLinked += transcriptMatches.length;
    console.log(`   Result: ${transcriptMatches.length} videos linked, ${transcriptSkipped} skipped`);

    // ========================================
    // Final Summary
    // ========================================
    const { count: totalVideos } = await supabase
      .from('knowledge_videos')
      .select('*', { count: 'exact', head: true })
      .not('pandavideo_id', 'is', null);

    const { count: linkedVideos } = await supabase
      .from('knowledge_videos')
      .select('*', { count: 'exact', head: true })
      .not('pandavideo_id', 'is', null)
      .not('content_id', 'is', null);

    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    console.log('\n🎉 LINKING COMPLETE!');
    console.log(`   Total videos: ${totalVideos}`);
    console.log(`   Videos linked: ${linkedVideos} (${((linkedVideos || 0) / (totalVideos || 1) * 100).toFixed(1)}%)`);
    console.log(`   This run linked: ${totalLinked}`);
    console.log(`   This run skipped: ${totalSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        version: '2.0-strict',
        results,
        totalLinkedThisRun: totalLinked,
        totalSkippedThisRun: totalSkipped,
        summary: {
          totalVideos: totalVideos || 0,
          linkedVideos: linkedVideos || 0,
          linkageRate: `${((linkedVideos || 0) / (totalVideos || 1) * 100).toFixed(1)}%`,
        },
        stopwordsCount: STOPWORDS.size,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Linking error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
