import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkResult {
  method: string;
  linked: number;
  videoIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun || false;
    const forceRelink = body.forceRelink || false;

    console.log('🔗 Starting intelligent video-to-article linking...');
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}, Force Relink: ${forceRelink}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: LinkResult[] = [];
    let totalLinked = 0;

    // ========================================
    // STEP 1: Match by Product ID (Score 100)
    // Video has product_id -> Article has it in recommended_products
    // ========================================
    console.log('\n📊 STEP 1: Matching by product_id...');
    
    const { data: videosWithProduct } = await supabase
      .from('knowledge_videos')
      .select('id, product_id, title')
      .not('product_id', 'is', null)
      .filter(forceRelink ? 'id' : 'content_id', 'is', null);

    const productMatches: string[] = [];
    
    if (videosWithProduct && videosWithProduct.length > 0) {
      for (const video of videosWithProduct) {
        // Find article that recommends this product
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
    
    results.push({ method: 'product_match', linked: productMatches.length, videoIds: productMatches });
    totalLinked += productMatches.length;
    console.log(`   Result: ${productMatches.length} videos linked by product`);

    // ========================================
    // STEP 2: Match by Resin ID (Score 90)
    // Video has resin_id -> Article has it in recommended_resins
    // ========================================
    console.log('\n📊 STEP 2: Matching by resin_id...');
    
    const { data: videosWithResin } = await supabase
      .from('knowledge_videos')
      .select('id, resin_id, title')
      .not('resin_id', 'is', null)
      .is('content_id', null);

    const resinMatches: string[] = [];
    
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
    
    results.push({ method: 'resin_match', linked: resinMatches.length, videoIds: resinMatches });
    totalLinked += resinMatches.length;
    console.log(`   Result: ${resinMatches.length} videos linked by resin`);

    // ========================================
    // STEP 3: Match by Category (Score 70)
    // Video product_category -> Article category name
    // ========================================
    console.log('\n📊 STEP 3: Matching by category...');
    
    const { data: videosWithCategory } = await supabase
      .from('knowledge_videos')
      .select('id, product_category, title')
      .not('product_category', 'is', null)
      .is('content_id', null);

    const categoryMatches: string[] = [];
    
    // Get category mappings
    const { data: categories } = await supabase
      .from('knowledge_categories')
      .select('id, name, letter');

    if (videosWithCategory && videosWithCategory.length > 0 && categories) {
      for (const video of videosWithCategory) {
        // Find matching category by name similarity
        const matchingCat = categories.find(cat => 
          cat.name.toLowerCase().includes(video.product_category!.toLowerCase()) ||
          video.product_category!.toLowerCase().includes(cat.name.toLowerCase())
        );

        if (matchingCat) {
          // Get first article in this category
          const { data: articles } = await supabase
            .from('knowledge_contents')
            .select('id, title')
            .eq('category_id', matchingCat.id)
            .eq('active', true)
            .order('order_index')
            .limit(1);

          if (articles && articles.length > 0) {
            console.log(`   ✅ Video "${video.title}" -> Article "${articles[0].title}" (category: ${matchingCat.name})`);
            
            if (!dryRun) {
              await supabase
                .from('knowledge_videos')
                .update({ content_id: articles[0].id })
                .eq('id', video.id);
            }
            categoryMatches.push(video.id);
          }
        }
      }
    }
    
    results.push({ method: 'category_match', linked: categoryMatches.length, videoIds: categoryMatches });
    totalLinked += categoryMatches.length;
    console.log(`   Result: ${categoryMatches.length} videos linked by category`);

    // ========================================
    // STEP 4: Match by Keyword Similarity (Score 60) - BERT-friendly
    // Strict matching: keyword must be >= 4 chars and appear exactly in video title
    // ========================================
    console.log('\n📊 STEP 4: Matching by keyword similarity (BERT)...');
    
    const { data: unlinkedVideos } = await supabase
      .from('knowledge_videos')
      .select('id, title')
      .is('content_id', null)
      .not('title', 'is', null)
      .limit(200);

    const keywordMatches: string[] = [];
    
    if (unlinkedVideos && unlinkedVideos.length > 0) {
      // Get all active articles with keywords
      const { data: articlesWithKeywords } = await supabase
        .from('knowledge_contents')
        .select('id, title, keywords')
        .eq('active', true)
        .not('keywords', 'is', null);

      if (articlesWithKeywords) {
        for (const video of unlinkedVideos) {
          const videoTitleLower = video.title.toLowerCase();
          const videoWords = videoTitleLower.split(/[\s\-_]+/).filter(w => w.length >= 3);
          let bestMatch: { articleId: string; score: number; articleTitle: string; matchedKeyword: string } | null = null;

          for (const article of articlesWithKeywords) {
            if (!article.keywords || article.keywords.length === 0) continue;

            // Check each keyword for STRICT match
            for (const keyword of article.keywords) {
              const keywordLower = keyword.toLowerCase().trim();
              
              // Keyword must be at least 4 chars to be meaningful
              if (keywordLower.length < 4) continue;
              
              // STRICT: keyword must appear as substring in video title
              // OR video title must contain at least 60% of keyword words
              const keywordWords = keywordLower.split(/[\s\-_]+/).filter(w => w.length >= 3);
              
              let matchScore = 0;
              
              // Check if full keyword is in title
              if (videoTitleLower.includes(keywordLower)) {
                matchScore = 0.95;
              } else if (keywordWords.length > 1) {
                // Check word overlap for multi-word keywords
                const matchedWords = keywordWords.filter(kw => videoTitleLower.includes(kw));
                const overlap = matchedWords.length / keywordWords.length;
                if (overlap >= 0.6) {
                  matchScore = 0.7 + (overlap * 0.2);
                }
              } else if (keywordWords.length === 1 && keywordLower.length >= 5) {
                // Single important word (e.g., "resina", "scanner", "exocad")
                if (videoTitleLower.includes(keywordLower)) {
                  matchScore = 0.75;
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

          // Only link if score is high enough (stricter threshold)
          if (bestMatch && bestMatch.score >= 0.7) {
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
    
    results.push({ method: 'keyword_similarity', linked: keywordMatches.length, videoIds: keywordMatches });
    totalLinked += keywordMatches.length;
    console.log(`   Result: ${keywordMatches.length} videos linked by keyword similarity`);

    // ========================================
    // STEP 5: Match by Transcript Full-Text Search (Score 50)
    // Search article title in video transcript
    // ========================================
    console.log('\n📊 STEP 5: Matching by transcript search...');
    
    const { data: videosWithTranscript } = await supabase
      .from('knowledge_videos')
      .select('id, title, video_transcript')
      .is('content_id', null)
      .not('video_transcript', 'is', null)
      .limit(100);

    const transcriptMatches: string[] = [];
    
    if (videosWithTranscript && videosWithTranscript.length > 0) {
      const { data: allArticles } = await supabase
        .from('knowledge_contents')
        .select('id, title')
        .eq('active', true);

      if (allArticles) {
        for (const video of videosWithTranscript) {
          const transcriptLower = video.video_transcript!.toLowerCase();
          
          for (const article of allArticles) {
            // Check if article title appears in transcript
            const articleWords = article.title.toLowerCase().split(' ').filter(w => w.length > 3);
            const matchCount = articleWords.filter(word => transcriptLower.includes(word)).length;
            const matchRatio = matchCount / articleWords.length;

            if (matchRatio >= 0.6) {
              console.log(`   ✅ Video "${video.title}" -> Article "${article.title}" (transcript match: ${(matchRatio * 100).toFixed(0)}%)`);
              
              if (!dryRun) {
                await supabase
                  .from('knowledge_videos')
                  .update({ content_id: article.id })
                  .eq('id', video.id);
              }
              transcriptMatches.push(video.id);
              break; // Only one match per video
            }
          }
        }
      }
    }
    
    results.push({ method: 'transcript_search', linked: transcriptMatches.length, videoIds: transcriptMatches });
    totalLinked += transcriptMatches.length;
    console.log(`   Result: ${transcriptMatches.length} videos linked by transcript`);

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

    console.log('\n🎉 LINKING COMPLETE!');
    console.log(`   Total videos: ${totalVideos}`);
    console.log(`   Videos linked: ${linkedVideos} (${((linkedVideos || 0) / (totalVideos || 1) * 100).toFixed(1)}%)`);
    console.log(`   This run linked: ${totalLinked}`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        results,
        totalLinkedThisRun: totalLinked,
        summary: {
          totalVideos: totalVideos || 0,
          linkedVideos: linkedVideos || 0,
          linkageRate: `${((linkedVideos || 0) / (totalVideos || 1) * 100).toFixed(1)}%`,
        },
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
