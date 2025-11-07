import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PANDAVIDEO_API_KEY = Deno.env.get("PANDAVIDEO_API_KEY");
    if (!PANDAVIDEO_API_KEY) {
      throw new Error("❌ PANDAVIDEO_API_KEY not configured");
    }

    const { action, videoId, page = 1, limit = 10 } = await req.json();
    
    const baseUrl = "https://api-v2.pandavideo.com.br";
    let url = "";
    let description = "";

    // Map actions to endpoints
    switch (action) {
      case "test_auth":
        url = `${baseUrl}/videos?page=1&limit=1`;
        description = "🔐 Testing authentication";
        break;
      
      case "list_videos":
        url = `${baseUrl}/videos?page=${page}&limit=${limit}`;
        description = `📹 Listing ${limit} videos (page ${page})`;
        break;
      
      case "get_video":
        if (!videoId) throw new Error("videoId required for get_video");
        url = `${baseUrl}/videos/${videoId}`;
        description = `🎬 Fetching video details: ${videoId}`;
        break;
      
      case "get_analytics":
        if (!videoId) throw new Error("videoId required for get_analytics");
        url = `${baseUrl}/videos/${videoId}/analytics`;
        description = `📊 Fetching analytics: ${videoId}`;
        break;
      
      case "list_folders":
        url = `${baseUrl}/folders`;
        description = "📁 Listing folders";
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`🔍 ${description}`);
    console.log(`📡 Calling: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${PANDAVIDEO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log(`📥 Response status: ${response.status}`);
    console.log(`📦 Response preview: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      data = { raw: responseText };
    }

    // Log structured data for debugging
    if (response.ok) {
      console.log("✅ Request successful");
      if (data.videos) {
        console.log(`📊 Found ${data.videos.length} videos`);
      }
      if (data.total) {
        console.log(`📊 Total videos available: ${data.total}`);
      }
    } else {
      console.error("❌ Request failed:", response.status, response.statusText);
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        action,
        description,
        url: url.replace(PANDAVIDEO_API_KEY, "***"), // Hide API key in response
        data,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in pandavideo-test:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
