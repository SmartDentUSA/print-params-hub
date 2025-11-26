import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PANDAVIDEO_KEY = Deno.env.get("PANDAVIDEO_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function normalize(v: number, max: number): number {
  return max > 0 ? Math.min(1, v / max) : 0;
}

function calculateRelevanceScore(m: any, ctx: any): number {
  const playRate = m.views > 0 ? (m.plays / m.views) * 100 : 0;

  const score =
    (playRate / 100) * 0.3 +
    (m.retention / 100) * 0.35 +
    normalize(m.unique_views, ctx.maxViews) * 0.2 +
    normalize(m.unique_plays, ctx.maxPlays) * 0.15;

  let finalScore = score * 100;

  // Penalidade forte se retenção muito baixa
  if (m.retention < 25) {
    finalScore *= 0.7;
  }

  return Number(finalScore.toFixed(2));
}

async function fetchJSON(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: PANDAVIDEO_KEY,
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok) {
      console.error(`❌ Error fetching ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error(`❌ Exception fetching ${url}:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting video analytics sync...');

    // Parse request body for limit parameter
    const { limit = 50 } = await req.json().catch(() => ({}));
    console.log(`📦 Processing batch size: ${limit}`);

    // Calculate timestamp for 24 hours ago
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get max values from existing data for normalization
    const { data: maxData } = await supabase
      .from("knowledge_videos")
      .select("analytics_unique_views, analytics_unique_plays")
      .not("analytics_unique_views", "is", null)
      .order("analytics_unique_views", { ascending: false })
      .limit(1)
      .single();

    let maxViews = maxData?.analytics_unique_views || 1;
    let maxPlays = maxData?.analytics_unique_plays || 1;

    // Count total videos needing sync
    const { count: totalCount } = await supabase
      .from("knowledge_videos")
      .select("id", { count: "exact", head: true })
      .not("pandavideo_id", "is", null)
      .or(`analytics_last_sync.is.null,analytics_last_sync.lt.${yesterday}`);

    console.log(`📊 Total videos needing sync: ${totalCount || 0}`);

    // Buscar vídeos NÃO sincronizados ou sincronizados há mais de 24h
    const { data: videos, error: videosError } = await supabase
      .from("knowledge_videos")
      .select("id, pandavideo_id, title")
      .not("pandavideo_id", "is", null)
      .or(`analytics_last_sync.is.null,analytics_last_sync.lt.${yesterday}`)
      .order("analytics_last_sync", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError);
      throw videosError;
    }

    if (!videos || videos.length === 0) {
      console.log('✅ All videos are up to date!');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "All videos are up to date", 
          updated: 0,
          remaining: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📹 Processing ${videos.length} videos in this batch`);

    let updatedCount = 0;

    // Processar e SALVAR IMEDIATAMENTE cada vídeo
    for (const v of videos) {
      console.log(`📊 Processing: ${v.title} (${v.pandavideo_id})`);

      const general = await fetchJSON(
        `https://data.pandavideo.com/general/${v.pandavideo_id}`
      );
      
      const retentionData = await fetchJSON(
        `https://data.pandavideo.com/retention/${v.pandavideo_id}`
      );

      if (!general) {
        console.log(`⚠️ No general analytics for ${v.pandavideo_id}`);
        continue;
      }

      const avgRetention = retentionData?.points?.length
        ? retentionData.points.reduce((sum: number, p: any) => sum + (p.retention || 0), 0) /
          retentionData.points.length
        : 0;

      const views = general.views || 0;
      const unique_views = general.unique_views || 0;
      const plays = general.plays || 0;
      const unique_plays = general.unique_plays || 0;
      const retention = Number(avgRetention.toFixed(2));

      // Atualizar maxViews/maxPlays dinamicamente
      maxViews = Math.max(maxViews, unique_views);
      maxPlays = Math.max(maxPlays, unique_plays);

      // Calcular score
      const score = calculateRelevanceScore(
        { views, plays, unique_views, unique_plays, retention },
        { maxViews, maxPlays }
      );

      const playRate = views > 0 ? Number(((plays / views) * 100).toFixed(2)) : 0;

      // SALVAR IMEDIATAMENTE (não acumular)
      const { error: updateError } = await supabase
        .from("knowledge_videos")
        .update({
          analytics_views: views,
          analytics_unique_views: unique_views,
          analytics_plays: plays,
          analytics_unique_plays: unique_plays,
          analytics_play_rate: playRate,
          analytics_avg_retention: retention,
          relevance_score: score,
          analytics_last_sync: new Date().toISOString(),
        })
        .eq("id", v.id);

      if (updateError) {
        console.error(`❌ Error updating video ${v.id}:`, updateError);
        continue;
      }

      // Inserir log de histórico
      const { error: logError } = await supabase
        .from("knowledge_video_metrics_log")
        .insert({
          knowledge_video_id: v.id,
          pandavideo_id: v.pandavideo_id,
          views,
          unique_views,
          plays,
          unique_plays,
          play_rate: playRate,
          avg_retention: retention,
          relevance_score: score,
        });

      if (logError) {
        console.error(`❌ Error inserting log for ${v.id}:`, logError);
      }

      updatedCount++;
      console.log(`✅ ${v.title}: ${views} views, ${retention}% retention, score: ${score}`);
    }

    const remaining = (totalCount || 0) - updatedCount;
    console.log(`✅ Batch completed! Updated ${updatedCount} videos, ${remaining} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        remaining: Math.max(0, remaining),
        total: totalCount || 0,
        maxViews,
        maxPlays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('❌ Fatal error in sync-video-analytics:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Unknown error",
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
