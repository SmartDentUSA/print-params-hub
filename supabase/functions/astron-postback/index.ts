import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Phone normalizer (same as sync-astron-members) ─── */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `+55${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET → validation probe from Astron platform
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", service: "astron-postback" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse body: JSON or form-urlencoded
    let body: Record<string, any>;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("form-urlencoded")) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
    }

    // 1. Validate token
    const expectedToken = Deno.env.get("ASTRON_POSTBACK_TOKEN");
    const receivedToken = req.headers.get("x-token") || body?.token;

    if (expectedToken && expectedToken !== receivedToken) {
      console.warn("[astron-postback] Invalid token received");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Extract event data
    const eventType: string = body.event_type || body.evento || "unknown";
    const userData = body.user || body.usuario || body.data || {};

    const email = (userData.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid user email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[astron-postback] Event: ${eventType} | Email: ${email}`);

    // 3. Build astron fields for upsert
    const now = new Date().toISOString();
    const phone = normalizePhone(userData.phone || userData.telefone);

    const astronFields: Record<string, unknown> = {
      astron_user_id: userData.id || userData.user_id || null,
      astron_status: userData.status || null,
      astron_nome: userData.name || userData.nome || null,
      astron_email: email,
      astron_phone: userData.phone || userData.telefone || null,
      astron_synced_at: now,
    };

    // Event-specific fields
    if (eventType === "course_progress" || eventType === "progresso_curso") {
      if (userData.courses_completed != null) {
        astronFields.astron_courses_completed = userData.courses_completed;
      }
      if (userData.courses_total != null) {
        astronFields.astron_courses_total = userData.courses_total;
      }
    }

    if (eventType === "new_user" || eventType === "novo_usuario") {
      astronFields.astron_created_at = userData.created_at || now;
      if (userData.plans_active) {
        astronFields.astron_plans_active = userData.plans_active;
      }
    }

    // 4. Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. Upsert: find by email → update or insert
    const { data: existing } = await supabase
      .from("lia_attendances")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    let action: string;

    if (existing) {
      const { error: updateErr } = await supabase
        .from("lia_attendances")
        .update(astronFields)
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
      action = "updated";
    } else {
      const { error: insertErr } = await supabase
        .from("lia_attendances")
        .insert({
          email,
          nome: userData.name || userData.nome || "Aluno Astron",
          source: "astron_postback",
          lead_status: "aluno",
          telefone_normalized: phone,
          telefone_raw: userData.phone || userData.telefone || null,
          ...astronFields,
        });

      if (insertErr) {
        // Handle unique constraint (race condition)
        if (insertErr.code === "23505") {
          await supabase
            .from("lia_attendances")
            .update(astronFields)
            .eq("email", email);
          action = "updated_after_conflict";
        } else {
          throw insertErr;
        }
      } else {
        action = "created";
      }
    }

    console.log(`[astron-postback] ${action} | ${eventType} | ${email}`);

    return new Response(
      JSON.stringify({ received: true, event_type: eventType, email, action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[astron-postback] Error: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
