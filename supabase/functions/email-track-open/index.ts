import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const GIF = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
  0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,
  0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
  0x44,0x01,0x00,0x3b,
]);

const headers = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const m = url.searchParams.get("m");
    if (m) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      // First open only — do not overwrite
      await supabase.rpc; // no-op reference to keep type
      const { data: existing } = await supabase
        .from("campaign_send_log")
        .select("id, opened_at, campaign_id")
        .eq("id", m)
        .maybeSingle();
      if (existing && !existing.opened_at) {
        await supabase.from("campaign_send_log")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", m);
      }
    }
  } catch (err) {
    console.error("[email-track-open]", err);
  }
  return new Response(GIF, { headers });
});