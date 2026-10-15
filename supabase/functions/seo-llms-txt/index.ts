// ═══════════════════════════════════════════════════════════
// 📄 /llms.txt — compact index of canonical public sources
// Mirrored at https://www.smartdent.com.br/llms.txt
// ═══════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { IDENTITY_V23 } from "../_shared/llms-identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(IDENTITY_V23, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Link": "<https://www.smartdent.com.br/llms.txt>; rel=\"describedby\"; type=\"text/markdown\"",
    },
  });
});

