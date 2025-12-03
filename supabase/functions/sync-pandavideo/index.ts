import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncParams {
  startPage?: number;
  maxPages?: number;
  limit?: number;
  onlyMissingCustomFields?: boolean;
}

// Normalize custom_fields array to object with cleaned keys
function normalizeCustomFields(customFieldsArray: any[]): Record<string, any> {
  if (!Array.isArray(customFieldsArray)) return {};
  
  const normalized: Record<string, any> = {};
  
  for (const field of customFieldsArray) {
    if (field.key && field.value !== undefined) {
      // Normalize key: remove accents, trim, replace spaces with underscore
      const normalizedKey = field.key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .trim()
        .replace(/\s+/g, '_'); // spaces to underscore
      
      normalized[normalizedKey] = field.value;
    }
  }
  
  return normalized;
}

// Extract ID_Lojaintegrada with case/space/accent tolerance
function extractLojaId(customFields: Record<string, any>): string | null {
  // Try exact match first
  if (customFields.ID_Lojaintegrada) return String(customFields.ID_Lojaintegrada);
  
  // Try variations
  const keys = Object.keys(customFields);
  const lojaKey = keys.find(k => 
    k.toLowerCase().replace(/[_\s]/g, '') === 'idlojaintegrada'
  );
  
  return lojaKey ? String(customFields[lojaKey]) : null;
}

// Fetch video details (basic info)
async function fetchVideoDetails(videoId: string, apiKey: string, baseUrl: string) {
  const headers = {
    'Authorization': apiKey,
    'Content-Type': 'application/json',
  };
  
  try {
    const response = await fetch(
      `${baseUrl}/videos/${videoId}`, 
      { headers }
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch details for video ${videoId}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching video ${videoId}:`, error);
    return null;
  }
}

// Fetch video custom_fields (separate call)
async function fetchVideoCustomFields(videoId: string, apiKey: string, baseUrl: string) {
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
      console.warn(`Failed to fetch custom_fields for video ${videoId}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    // A API retorna o array diretamente, não dentro de uma propriedade
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching custom_fields for video ${videoId}:`, error);
    return [];
  }
}

// Extract subtitles and audios from videoDetails.config (no extra API call needed!)
async function extractSubtitlesFromVideoDetails(
  videoDetails: any
): Promise<{ subtitles_info: any[]; audios_info: any[]; transcript: string | null }> {
  
  const videoId = videoDetails?.id || 'unknown';
  const subtitles = videoDetails?.config?.subtitles || [];
  const audios = videoDetails?.config?.audios || [];
  
  console.log(`🔍 Video ${videoId}: found ${subtitles.length} subtitles, ${audios.length} audios`);
  
  if (subtitles.length > 0) {
    console.log(`   Subtitle languages: ${subtitles.map((s: any) => s.srclang).join(', ')}`);
  }
  
  if (audios.length > 0) {
    console.log(`   Audio languages: ${audios.map((a: any) => a.lang).join(', ')}`);
  }
  
  // If no subtitles, return early
  if (subtitles.length === 0) {
    return { subtitles_info: [], audios_info: audios, transcript: null };
  }
  
  // Find pt-BR subtitle for transcript extraction
  const ptBR = subtitles.find((s: any) => s.srclang === 'pt-BR');
  if (!ptBR || !ptBR.url) {
    console.log(`   ℹ️ No pt-BR subtitle URL available`);
    return { subtitles_info: subtitles, audios_info: audios, transcript: null };
  }
  
  try {
    console.log(`📥 Downloading VTT from: ${ptBR.url}`);
    
    // Download VTT from public CDN (no auth needed)
    const vttResponse = await fetch(ptBR.url);
    
    if (!vttResponse.ok) {
      console.log(`⚠️ Failed to download VTT (${vttResponse.status})`);
      return { subtitles_info: subtitles, audios_info: audios, transcript: null };
    }
    
    const vttContent = await vttResponse.text();
    
    // Parse VTT to plain text
    const transcript = vttContent
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed !== '' &&
          !trimmed.startsWith('WEBVTT') && 
          !trimmed.includes('-->') && 
          !trimmed.startsWith('X-TIMESTAMP') &&
          !/^\d+$/.test(trimmed);
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`✅ Transcript extracted: ${transcript.length} chars`);
    
    return { subtitles_info: subtitles, audios_info: audios, transcript };
    
  } catch (error) {
    console.error(`❌ Error downloading/parsing VTT for ${videoId}:`, error);
    return { subtitles_info: subtitles, audios_info: audios, transcript: null };
  }
}

async function linkVideoToProduct(supabase: any, customFields: any) {
  const lojaId = extractLojaId(customFields);
  
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

  // Try system_a_catalog first
  const { data: catalogProduct } = await supabase
    .from('system_a_catalog')
    .select('id')
    .eq('external_id', lojaId)
    .maybeSingle();

  if (catalogProduct) {
    return {
      product_match_status: 'matched',
      product_external_id: lojaId,
      product_id: catalogProduct.id,
      resin_id: null,
      product_category: customFields?.Categoria || null,
      product_subcategory: customFields?.Subcategoria || null,
    };
  }

  // Fallback to resins
  const { data: resinProduct } = await supabase
    .from('resins')
    .select('id')
    .eq('external_id', lojaId)
    .maybeSingle();

  if (resinProduct) {
    return {
      product_match_status: 'matched',
      product_external_id: lojaId,
      product_id: null,
      resin_id: resinProduct.id,
      product_category: customFields?.Categoria || null,
      product_subcategory: customFields?.Subcategoria || null,
    };
  }

  return {
    product_match_status: 'not_found',
    product_external_id: lojaId,
    product_id: null,
    resin_id: null,
    product_category: customFields?.Categoria || null,
    product_subcategory: customFields?.Subcategoria || null,
  };
}

function toIntOrNull(val: any): number | null {
  if (val === null || val === undefined) return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse params from body
    const body = await req.json().catch(() => ({}));
    const params: SyncParams = {
      startPage: body.startPage || 1,
      maxPages: body.maxPages || 1,
      limit: body.limit || 50,
      onlyMissingCustomFields: body.onlyMissingCustomFields || false,
    };

    console.log('🚀 Starting PandaVideo sync with params:', params);

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

    // 1. Sincronizar folders (apenas na primeira página)
    let syncedFolders = 0;
    if (params.startPage === 1) {
      console.log('📁 Fetching folders...');
      const foldersRes = await fetch(`${baseUrl}/folders`, { headers });
      
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        
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

            if (!error) syncedFolders++;
          }
          console.log(`✅ Synced ${syncedFolders} folders`);
        }
      }
    }

    // 2. Sincronizar vídeos (página limitada)
    let currentPage = params.startPage;
    let processedVideos = 0;
    let updatedVideos = 0;
    let skippedVideos = 0;
    let totalVideos = 0;
    let pagesProcessed = 0;

    for (let i = 0; i < params.maxPages; i++) {
      console.log(`📹 Fetching videos page ${currentPage} (limit ${params.limit})...`);
      const videosRes = await fetch(
        `${baseUrl}/videos?page=${currentPage}&limit=${params.limit}`, 
        { headers }
      );
      
      if (!videosRes.ok) {
        const errText = await videosRes.text();
        console.error(`❌ Failed to fetch videos page ${currentPage}: ${videosRes.status}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `PandaVideo API error ${videosRes.status}: ${errText}`,
            page: currentPage,
          }),
          { 
            status: videosRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const videosData = await videosRes.json();
      totalVideos = videosData.total || 0;

      if (!videosData.videos || videosData.videos.length === 0) {
        console.log('✅ No more videos to process');
        break;
      }

      pagesProcessed++;
      let sampleLogged = false;

      // Process videos
      for (const video of videosData.videos) {
        processedVideos++;

        // Check existing video to preserve content_id
        const { data: existingVideo } = await supabase
          .from('knowledge_videos')
          .select('id, panda_custom_fields, content_id')
          .eq('pandavideo_id', video.id)
          .maybeSingle();

        // Skip if only processing missing custom_fields and already has them
        if (params.onlyMissingCustomFields) {
          if (existingVideo && existingVideo.panda_custom_fields && 
              Object.keys(existingVideo.panda_custom_fields).length > 0) {
            skippedVideos++;
            continue;
          }
        }

        // Fetch details + custom_fields from PandaVideo API
        const videoDetails = await fetchVideoDetails(video.id, pandaApiKey, baseUrl);
        const customFieldsArray = await fetchVideoCustomFields(video.id, pandaApiKey, baseUrl);
        
        // Extract subtitles and audios from videoDetails.config (no extra API call!)
        const { subtitles_info, audios_info, transcript } = await extractSubtitlesFromVideoDetails(videoDetails);
        
        // Normalize custom_fields
        const customFields = normalizeCustomFields(customFieldsArray);
        
        // Build panda_config with subtitles and audios metadata
        const pandaConfig = {
          ...(videoDetails?.config || {}),
          subtitles: subtitles_info,
          audios: audios_info,
          has_transcript: !!transcript,
          subtitles_count: subtitles_info.length,
          audios_count: audios_info.length,
        };
        
        // Log sample (first video of page)
        if (!sampleLogged && Object.keys(customFields).length > 0) {
          console.log(`📊 Sample custom_fields for ${video.id}:`, JSON.stringify(customFields));
          sampleLogged = true;
        }
        
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
          
          video_transcript: transcript,
          panda_custom_fields: customFields,
          panda_config: pandaConfig,
          
          ...productLink,
          
          order_index: existingVideo?.id ? undefined : 0, // Only set on new videos
          content_id: existingVideo?.content_id || null, // ✅ PRESERVE existing content_id!
        };

        // Upsert video (atomic operation, prevents duplicates)
        const { error } = await supabase
          .from('knowledge_videos')
          .upsert(videoData, { 
            onConflict: 'pandavideo_id',
            ignoreDuplicates: false // Always update if exists
          });

        if (!error) updatedVideos++;
      }

      // Check if there are more pages
      if (videosData.videos.length < params.limit) {
        console.log('✅ Reached last page');
        break;
      }

      currentPage++;
    }

    console.log(`✅ Page processing complete: processed=${processedVideos}, updated=${updatedVideos}, skipped=${skippedVideos}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          folders: syncedFolders,
          processed: processedVideos,
          updated: updatedVideos,
          skipped: skippedVideos,
          pages_processed: pagesProcessed,
          current_page: currentPage,
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
