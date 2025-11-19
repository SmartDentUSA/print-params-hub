import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractVideoContentRequest {
  videoType: 'youtube' | 'pandavideo';
  videoId: string;
  includeTranscript: boolean;
  includeDescription: boolean;
  preferredLanguage?: 'pt-BR' | 'en' | 'es';
}

interface ExtractVideoContentResponse {
  success: boolean;
  data?: {
    transcript: string;
    description: string;
    language: string;
    videoTitle: string;
  };
  error?: string;
}

function parseVTTToPlainText(vtt: string): string {
  // Remove WEBVTT header
  let text = vtt.replace(/WEBVTT\s*\n/, '');
  
  // Remove timestamps (00:00:00.000 --> 00:00:05.000)
  text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '');
  
  // Remove cue numbers
  text = text.replace(/^\d+\s*$/gm, '');
  
  // Remove multiple empty lines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  return text.trim();
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PANDAVIDEO_API_KEY = Deno.env.get('PANDAVIDEO_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: ExtractVideoContentRequest = await req.json();
    const { videoType, videoId, includeTranscript, includeDescription, preferredLanguage = 'pt-BR' } = body;

    console.log(`Extracting content for ${videoType} video: ${videoId}`);

    let transcript = '';
    let description = '';
    let language = preferredLanguage;
    let videoTitle = '';

    if (videoType === 'pandavideo') {
      if (!PANDAVIDEO_API_KEY) {
        throw new Error('PANDAVIDEO_API_KEY not configured');
      }

      // Primeiro, tentar buscar transcrição do cache
      if (includeTranscript) {
        const { data: cachedVideo } = await supabase
          .from('knowledge_videos')
          .select('video_transcript, title, description')
          .eq('pandavideo_id', videoId)
          .single();

        if (cachedVideo?.video_transcript) {
          console.log('Using cached transcript from knowledge_videos');
          
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                transcript: cachedVideo.video_transcript,
                description: includeDescription ? (cachedVideo.description || '') : '',
                language: preferredLanguage,
                videoTitle: cachedVideo.title
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Fetch video details from API
      const videoDetailsResponse = await fetch(
        `https://api-v2.pandavideo.com.br/videos/${videoId}?custom_fields=true`,
        {
          headers: {
            'Authorization': `Bearer ${PANDAVIDEO_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!videoDetailsResponse.ok) {
        const errorText = await videoDetailsResponse.text();
        console.error(`PandaVideo API error: ${videoDetailsResponse.status} - ${errorText}`);
        throw new Error(`Failed to fetch video details: ${videoDetailsResponse.statusText}. Verifique se a PANDAVIDEO_API_KEY está configurada corretamente.`);
      }

      const videoDetails = await videoDetailsResponse.json();
      videoTitle = videoDetails.title || 'Video';
      description = videoDetails.description || '';

      console.log(`Video title: ${videoTitle}`);

      if (includeTranscript) {
        // Try to get transcript from panda_config if available
        const { data: dbVideo } = await supabase
          .from('knowledge_videos')
          .select('video_transcript, panda_config')
          .eq('pandavideo_id', videoId)
          .single();

        if (dbVideo?.video_transcript) {
          console.log('Using cached transcript from database');
          transcript = dbVideo.video_transcript;
          
          // Try to get language from panda_config
          if (dbVideo.panda_config && typeof dbVideo.panda_config === 'object') {
            const config = dbVideo.panda_config as any;
            if (config.subtitles && Array.isArray(config.subtitles) && config.subtitles.length > 0) {
              language = config.subtitles[0].srclang || preferredLanguage;
            }
          }
        } else {
          console.log('No cached transcript, fetching from PandaVideo API');
          
          // Check if video has subtitles in panda_config
          if (dbVideo?.panda_config && typeof dbVideo.panda_config === 'object') {
            const config = dbVideo.panda_config as any;
            if (config.subtitles && Array.isArray(config.subtitles) && config.subtitles.length > 0) {
              // Find preferred language or use first available
              const subtitle = config.subtitles.find((s: any) => s.srclang === preferredLanguage) || config.subtitles[0];
              
              if (subtitle && subtitle.src) {
                console.log(`Fetching subtitle from: ${subtitle.src}`);
                
                const subtitleResponse = await fetch(subtitle.src);
                if (subtitleResponse.ok) {
                  const vttContent = await subtitleResponse.text();
                  transcript = parseVTTToPlainText(vttContent);
                  language = subtitle.srclang || preferredLanguage;
                  
                  console.log(`Successfully extracted transcript (${transcript.length} chars)`);
                  
                  // Save transcript to database for future use
                  await supabase
                    .from('knowledge_videos')
                    .update({ 
                      video_transcript: transcript,
                    })
                    .eq('pandavideo_id', videoId);
                } else {
                  console.error('Failed to fetch subtitle file:', subtitleResponse.statusText);
                }
              }
            } else {
              console.log('No subtitles available in panda_config');
            }
          } else {
            console.log('Video not found in database or no panda_config');
          }
        }
      }
    } else if (videoType === 'youtube') {
      // Extract video ID from URL
      const ytVideoId = extractYouTubeId(videoId);
      if (!ytVideoId) {
        throw new Error('Invalid YouTube URL');
      }

      console.log(`YouTube video ID: ${ytVideoId}`);

      // For YouTube, we'll use a simple fetch to get the page title and description
      // Note: Full API integration would require API key and has quotas
      try {
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${ytVideoId}`);
        const pageHtml = await pageResponse.text();
        
        // Extract title from meta tags
        const titleMatch = pageHtml.match(/<meta name="title" content="([^"]+)"/);
        videoTitle = titleMatch ? titleMatch[1] : 'YouTube Video';
        
        // Extract description from meta tags
        const descMatch = pageHtml.match(/<meta name="description" content="([^"]+)"/);
        description = descMatch ? descMatch[1] : '';
        
        console.log(`Extracted YouTube title: ${videoTitle}`);
      } catch (error) {
        console.error('Error fetching YouTube data:', error);
        videoTitle = 'YouTube Video';
        description = 'Description not available';
      }

      // Note: YouTube transcript extraction requires complex OAuth2 or third-party tools
      if (includeTranscript) {
        transcript = '⚠️ Transcrições automáticas do YouTube não estão disponíveis no momento. Por favor, copie manualmente a transcrição do YouTube se disponível.';
      }
    }

    const response: ExtractVideoContentResponse = {
      success: true,
      data: {
        transcript,
        description: includeDescription ? description : '',
        language,
        videoTitle,
      }
    };

    console.log('Extraction completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in extract-video-content:', error);
    
    const errorResponse: ExtractVideoContentResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
