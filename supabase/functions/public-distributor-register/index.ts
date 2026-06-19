import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// Allowed columns to insert — whitelist prevents arbitrary writes
const ALLOWED = new Set([
  "razao_social", "nome_fantasia", "logo_url",
  "pais", "estado", "cidade", "endereco", "cep", "numero_unidades",
  "site_url", "instagram", "facebook", "linkedin", "youtube",
  "owner_name", "owner_email", "owner_whatsapp_ddi", "owner_whatsapp",
  "buyer_name", "buyer_email", "buyer_whatsapp_ddi", "buyer_whatsapp",
  "notes", "authorized_scope",
]);

function sanitize(input: any): Record<string, any> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!ALLOWED.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  if (typeof out.razao_social === "string") out.razao_social = out.razao_social.trim().slice(0, 255);
  if (typeof out.nome_fantasia === "string") out.nome_fantasia = out.nome_fantasia.trim().slice(0, 255);
  if (typeof out.numero_unidades === "number") {
    out.numero_unidades = Math.max(1, Math.min(9999, Math.floor(out.numero_unidades)));
  } else delete out.numero_unidades;
  // basic email guard
  for (const k of ["owner_email", "buyer_email"]) {
    if (out[k] && typeof out[k] === "string") {
      if (!/^\S+@\S+\.\S+$/.test(out[k])) delete out[k];
      else out[k] = String(out[k]).slice(0, 255);
    }
  }
  if (out.authorized_scope && typeof out.authorized_scope !== "object") {
    delete out.authorized_scope;
  }
  return out;
}

async function checkRateLimit(ipHash: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("smart_form_rate_limit")
    .select("ip_hash, window_start, request_count")
    .eq("ip_hash", ipHash)
    .gte("window_start", hourAgo)
    .maybeSingle();
  if (data && (data.request_count ?? 0) >= 5) return false;
  if (data) {
    await supabase
      .from("smart_form_rate_limit")
      .update({ request_count: (data.request_count ?? 0) + 1 })
      .eq("ip_hash", ipHash);
  } else {
    await supabase.from("smart_form_rate_limit").insert({
      ip_hash: ipHash,
      window_start: new Date().toISOString(),
      request_count: 1,
    });
  }
  return true;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "|distributor-register");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  try {
    const comma = dataUrl.indexOf(",");
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function contentTypeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await hashIp(ip);

    const ok = await checkRateLimit(ipHash);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Muitos cadastros recentes. Tente novamente em 1 hora." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const payload = sanitize(body?.payload);

    if (!payload.razao_social || payload.razao_social.length < 2) {
      return new Response(JSON.stringify({ error: "Razão Social é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Logo upload (optional)
    if (body?.logoBase64) {
      const bytes = decodeBase64DataUrl(body.logoBase64);
      if (bytes && bytes.length > 0 && bytes.length <= 5 * 1024 * 1024) {
        const ext = (body.logoExt || "png").toString().replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("distributor-logos")
          .upload(path, bytes, { contentType: contentTypeFromExt(ext), cacheControl: "3600", upsert: false });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("distributor-logos").getPublicUrl(path);
          payload.logo_url = pub.publicUrl;
        } else {
          console.error("Logo upload failed:", upErr.message);
        }
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("distributors")
      .insert({ ...payload, active: true })
      .select("id")
      .single();

    if (insErr) {
      console.error("Insert distributor failed:", insErr.message);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("public-distributor-register error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});