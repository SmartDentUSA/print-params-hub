import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility: convert duration to integer (handle decimals from PandaVideo API)
const toIntOrNull = (val: unknown): number | null => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : null;
};

// Fetch individual video details including custom_fields
async function fetchVideoDetails(videoId: string, apiKey: string, baseUrl: string) {
  const headers = {
    'Authorization': apiKey,
    'Content-Type': 'application/json',
  };
  
  try {
    const response = await fetch(
      `${baseUrl}/videos/${videoId}?custom_fields=true`, 
      { headers }
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch details for video ${videoId}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching video ${videoId}:`, error);
    return null;
  }
}

// Link video to product using ID_Lojaintegrada
async function linkVideoToProduct(supabase: any, customFields: any) {
  const lojaId = customFields?.ID_Lojaintegrada;
  
  if (!lojaId) {
    return {
      product_match_status: 'not_found',
      product_external_id: null,
      product_id: null,
      resin_id: null,
      product_category: customFields?.Categoria || null,
      product_subcategory: customFields?.Subcategoria || null,
    };
  }
  
  // 1. Buscar em system_a_catalog (prioridade)
  const { data: catalogProduct } = await supabase
    .from('system_a_catalog')
    .select('id, external_id')
    .eq('external_id', String(lojaId))
    .maybeSingle();
  
  if (catalogProduct) {
    return {
      product_match_status: 'matched',
      product_external_id: String(lojaId),
      product_id: catalogProduct.id,
      resin_id: null,
      product_category: customFields?.Categoria || null,
      product_subcategory: customFields?.Subcategoria || null,
      last_product_sync_at: new Date().toISOString(),
    };
  }
  
  // 2. Fallback: buscar em resins
  const { data: resin } = await supabase
    .from('resins')
    .select('id, external_id')
    .eq('external_id', String(lojaId))
    .maybeSingle();
  
  if (resin) {
    return {
      product_match_status: 'matched',
      product_external_id: String(lojaId),
      product_id: null,
      resin_id: resin.id,
      product_category: customFields?.Categoria || null,
      product_subcategory: customFields?.Subcategoria || null,
      last_product_sync_at: new Date().toISOString(),
    };
  }
  
  return {
    product_match_status: 'not_found',
    product_external_id: String(lojaId),
    product_id: null,
    resin_id: null,
    product_category: customFields?.Categoria || null,
    product_subcategory: customFields?.Subcategoria || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const pandaApiKey = Deno.env.get('PANDAVIDEO_API_KEY');
    if (!pandaApiKey) {
      throw new Error('PANDAVIDEO_API_KEY not configured');
    }

    const baseUrl = 'https://api-v2.pandavideo.com.br';
    const headers = {
      'Authorization': pandaApiKey,
      'Content-Type': 'application/json',
    };

    console.log('🚀 Starting PandaVideo sync...');

    // 1. Sincronizar folders primeiro
    console.log('📁 Fetching folders...');
    const foldersRes = await fetch(`${baseUrl}/folders`, { headers });
    
    if (!foldersRes.ok) {
      const errText = await foldersRes.text();
      console.error(`❌ Failed to fetch folders: ${foldersRes.status} ${errText}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `PandaVideo folders error ${foldersRes.status}: ${errText}`,
        }),
        { 
          status: foldersRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const foldersData = await foldersRes.json();
    
    let syncedFolders = 0;
    if (foldersData.folders) {
      for (const folder of foldersData.folders) {
        const { error } = await supabase.from('pandavideo_folders').upsert({
          pandavideo_id: folder.id,
          name: folder.name,
          parent_folder_id: folder.parent_folder_id || null,
          videos_count: folder.videos_count || 0,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'pandavideo_id' });

        if (!error) {
          syncedFolders++;
        } else {
          console.error(`Error syncing folder ${folder.id}:`, error);
        }
      }
      console.log(`✅ Synced ${syncedFolders} folders`);
    }

    // 2. Sincronizar vídeos (paginação)
    let page = 1;
    let totalVideos = 0;
    let syncedVideos = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`📹 Fetching videos page ${page}...`);
      const videosRes = await fetch(`${baseUrl}/videos?page=${page}&limit=50`, { headers });
      
      if (!videosRes.ok) {
        const errText = await videosRes.text();
        console.error(`❌ Failed to fetch videos page ${page}: ${videosRes.status} ${errText}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `PandaVideo videos error ${foldersRes.status}: ${errText}`,
            page,
          }),
          { 
            status: videosRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const videosData = await videosRes.json();

      if (!videosData.videos || videosData.videos.length === 0) {
        hasMore = false;
        break;
      }

      totalVideos = videosData.total || 0;

      // Upsert vídeos
      for (const video of videosData.videos) {
        // Buscar detalhes completos do vídeo
        const videoDetails = await fetchVideoDetails(video.id, pandaApiKey, baseUrl);
        
        const customFields = videoDetails?.custom_fields || {};
        const tags = videoDetails?.tags || [];
        const transcript = videoDetails?.transcript || null;
        
        // Vincular produto
        const productLink = await linkVideoToProduct(supabase, customFields);
        
        const videoData = {
          video_type: 'pandavideo',
          pandavideo_id: video.id,
          pandavideo_external_id: video.video_external_id || null,
          folder_id: video.folder_id || null,
          title: video.title || 'Sem título',
          description: video.description || null,
          thumbnail_url: video.thumbnail || null,
          preview_url: video.preview || null,
          embed_url: video.video_player || null,
          hls_url: video.video_hls || null,
          video_duration_seconds: toIntOrNull(video.length),
          
          // 🆕 ENRIQUECIMENTO
          panda_custom_fields: customFields,
          panda_tags: tags,
          analytics: {
            views: videoDetails?.views || 0,
            watch_time_seconds: videoDetails?.watch_time || 0,
            engagement_rate: videoDetails?.engagement_rate || 0,
            last_viewed_at: videoDetails?.last_viewed_at || null,
            synced_at: new Date().toISOString()
          },
          video_transcript: transcript,
          
          // 🆕 VINCULAÇÃO PRODUTO
          ...productLink,
          
          order_index: 0,
          content_id: null,
        };

        // Check if video already exists
        const { data: existing } = await supabase
          .from('knowledge_videos')
          .select('id')
          .eq('pandavideo_id', video.id)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('knowledge_videos')
            .update(videoData)
            .eq('id', existing.id);

          if (error) {
            console.error(`Error updating video ${video.id}:`, error);
          } else {
            syncedVideos++;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('knowledge_videos')
            .insert(videoData);

          if (error) {
            console.error(`Error inserting video ${video.id}:`, error);
          } else {
            syncedVideos++;
          }
        }
      }

      // Próxima página
      if (videosData.videos.length < 50 || syncedVideos >= totalVideos) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`✅ Synced ${syncedVideos} videos`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          folders: syncedFolders,
          videos: syncedVideos,
          total_videos: totalVideos,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Sync error:', error);
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
