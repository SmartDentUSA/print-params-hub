import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_STORAGE_URL = 'https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/resin-documents';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract filename from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];

    if (!filename) {
      console.error('No filename provided in path:', url.pathname);
      return new Response(JSON.stringify({ error: 'Filename is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching document:', filename);

    // Fetch the file from Supabase Storage
    const storageUrl = `${SUPABASE_STORAGE_URL}/${filename}`;
    console.log('Storage URL:', storageUrl);

    const fileResponse = await fetch(storageUrl);

    if (!fileResponse.ok) {
      console.error('File not found:', filename, 'Status:', fileResponse.status);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the file content
    const fileContent = await fileResponse.arrayBuffer();
    
    console.log('Document fetched successfully:', filename, 'Size:', fileContent.byteLength);

    // Return the PDF with correct headers for inline display
    return new Response(fileContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('Error in document-proxy function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
