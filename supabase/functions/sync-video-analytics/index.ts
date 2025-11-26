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

    // Buscar todos os vídeos com pandavideo_id
    const { data: videos, error: videosError } = await supabase
      .from("knowledge_videos")
      .select("id, pandavideo_id, title")
      .not("pandavideo_id", "is", null);

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError);
      throw videosError;
    }

    if (!videos || videos.length === 0) {
      console.log('⚠️ No videos with pandavideo_id found');
      return new Response(
        JSON.stringify({ message: "No videos with pandavideo_id found", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📹 Found ${videos.length} videos to process`);

    let maxViews = 0;
    let maxPlays = 0;
    const analytics: any[] = [];

    // Buscar analytics para cada vídeo
    for (const v of videos) {
      console.log(`📊 Processing video: ${v.title} (${v.pandavideo_id})`);

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

      const record = {
        id: v.id,
        pandavideo_id: v.pandavideo_id,
        views: general.views || 0,
        unique_views: general.unique_views || 0,
        plays: general.plays || 0,
        unique_plays: general.unique_plays || 0,
        retention: Number(avgRetention.toFixed(2)),
      };

      maxViews = Math.max(maxViews, record.unique_views);
      maxPlays = Math.max(maxPlays, record.unique_plays);
      analytics.push(record);

      console.log(`✅ ${v.title}: ${record.views} views, ${record.retention}% retention`);
    }

    console.log(`📈 Max views: ${maxViews}, Max plays: ${maxPlays}`);
    console.log(`💾 Updating ${analytics.length} videos in database...`);

    // Calcular score e atualizar banco
    let updatedCount = 0;
    for (const row of analytics) {
      const score = calculateRelevanceScore(row, { maxViews, maxPlays });
      const playRate = row.views > 0 ? Number(((row.plays / row.views) * 100).toFixed(2)) : 0;

      // Atualizar knowledge_videos
      const { error: updateError } = await supabase
        .from("knowledge_videos")
        .update({
          analytics_views: row.views,
          analytics_unique_views: row.unique_views,
          analytics_plays: row.plays,
          analytics_unique_plays: row.unique_plays,
          analytics_play_rate: playRate,
          analytics_avg_retention: row.retention,
          relevance_score: score,
          analytics_last_sync: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        console.error(`❌ Error updating video ${row.id}:`, updateError);
        continue;
      }

      // Inserir log de histórico
      const { error: logError } = await supabase
        .from("knowledge_video_metrics_log")
        .insert({
          knowledge_video_id: row.id,
          pandavideo_id: row.pandavideo_id,
          views: row.views,
          unique_views: row.unique_views,
          plays: row.plays,
          unique_plays: row.unique_plays,
          play_rate: playRate,
          avg_retention: row.retention,
          relevance_score: score,
        });

      if (logError) {
        console.error(`❌ Error inserting log for ${row.id}:`, logError);
      } else {
        updatedCount++;
      }
    }

    console.log(`✅ Sync completed! Updated ${updatedCount}/${analytics.length} videos`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        total: videos.length,
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
