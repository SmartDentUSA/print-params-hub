import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: existing } = await supabase.storage.getBucket("distributor-logos");
  if (existing) {
    return new Response(JSON.stringify({ ok: true, existed: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase.storage.createBucket("distributor-logos", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, created: true }), {
    headers: { "Content-Type": "application/json" },
  });
});