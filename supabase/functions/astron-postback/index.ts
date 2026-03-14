import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    // Parse body
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

    console.log(`[astron-postback] Raw payload keys: ${Object.keys(body).join(", ")}`);

    // 1. Validate token
    const expectedToken = Deno.env.get("ASTRON_POSTBACK_TOKEN");
    const receivedToken = body?.token;

    if (expectedToken && receivedToken && expectedToken !== receivedToken) {
      console.warn("[astron-postback] Invalid token received");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation probe: Astron sends {"key":"..."} to test the URL
    if (!body.event && !body.event_type && !body.email && !body.user_email) {
      console.log("[astron-postback] Validation probe received, returning 200");
      return new Response(
        JSON.stringify({ status: "ok", service: "astron-postback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Extract event type (flat format from Astron)
    const eventType: string = body.event || body.event_type || "unknown";

    // 3. Extract email (flat: body.email or body.user_email)
    const email = (body.email || body.user_email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid email", received_keys: Object.keys(body) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Extract name (flat)
    const name = body.name || body.user_name || body.nome || "";

    console.log(`[astron-postback] Event: ${eventType} | Email: ${email} | Name: ${name}`);

    // 5. Build astron fields based on event type
    const now = new Date().toISOString();
    const phone = normalizePhone(body.phone || body.user_phone || body.telefone);

    const astronFields: Record<string, unknown> = {
      astron_user_id: body.user_id || body.id || null,
      astron_status: body.status || "active",
      astron_nome: name || null,
      astron_email: email,
      astron_phone: body.phone || body.user_phone || null,
      astron_synced_at: now,
      astron_login_url: body.login_url || null,
    };

    // Event-specific: useradd
    if (eventType === "useradd") {
      astronFields.astron_created_at = body.insert_time || now;
      if (body.plans_active) {
        astronFields.astron_plans_active = Array.isArray(body.plans_active)
          ? body.plans_active : [body.plans_active];
      }
      // Facebook tracking IDs
      if (body.fbc) astronFields.astron_fbc = body.fbc;
      if (body.fbp) astronFields.astron_fbp = body.fbp;
    }

    // Event-specific: usercourseprogresschange
    if (eventType === "usercourseprogresschange") {
      const courseEntry = {
        course_id: body.course_id || null,
        course_name: body.course_name || null,
        percentage: body.user_course_percentage ?? null,
        completed_classes: body.user_course_completed_classes ?? null,
        total_classes: body.course_total_classes ?? null,
        change_time: body.change_time || null,
        updated_at: now,
      };
      // We'll merge this into existing astron_courses_access below
      astronFields._course_entry = courseEntry;

    }

    // Event-specific: newcomment
    if (eventType === "newcomment") {
      astronFields.astron_last_interaction_at = now;
      astronFields.astron_last_interaction_type = "comment";
    }

    // Event-specific: newsupportticket
    if (eventType === "newsupportticket") {
      astronFields.astron_last_interaction_at = now;
      astronFields.astron_last_interaction_type = "support_ticket";
    }

    // 6. Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 7. Upsert: find by email → update or insert
    const { data: existing } = await supabase
      .from("lia_attendances")
      .select("id, astron_courses_access, astron_courses_completed")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    // Handle course progress merge
    const courseEntry = astronFields._course_entry as Record<string, unknown> | undefined;
    delete astronFields._course_entry;

    if (courseEntry && courseEntry.course_id) {
      const raw = existing?.astron_courses_access;
      const existingCourses: any[] = Array.isArray(raw) ? raw : [];
      const idx = existingCourses.findIndex(
        (c: any) => c.course_id === courseEntry.course_id
      );
      if (idx >= 0) {
        existingCourses[idx] = { ...existingCourses[idx], ...courseEntry };
      } else {
        existingCourses.push(courseEntry);
      }
      astronFields.astron_courses_access = existingCourses;
      astronFields.astron_courses_total = existingCourses.length;
      astronFields.astron_courses_completed = existingCourses.filter(
        (c: any) => Number(c.percentage) >= 100
      ).length;
    }

    // UTM fields (useradd)
    const utmFields: Record<string, unknown> = {};
    if (eventType === "useradd") {
      if (body.utm_campaign) utmFields.utm_campaign = body.utm_campaign;
      if (body.utm_source) utmFields.utm_source = body.utm_source;
      if (body.utm_medium) utmFields.utm_medium = body.utm_medium;
      if (body.utm_term) utmFields.utm_term = body.utm_term;
      if (body.origem_campanha || body.utm_content) {
        utmFields.origem_campanha = body.origem_campanha || body.utm_content;
      }
    }

    // Remove fields that don't exist in the table (stored only in raw_payload)
    delete astronFields.astron_fbc;
    delete astronFields.astron_fbp;
    delete astronFields.astron_last_interaction_at;
    delete astronFields.astron_last_interaction_type;

    let action: string;

    if (existing) {
      const { error: updateErr } = await supabase
        .from("lia_attendances")
        .update({ ...astronFields, ...utmFields, raw_payload: body })
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
      action = "updated";
    } else {
      const { error: insertErr } = await supabase
        .from("lia_attendances")
        .insert({
          email,
          nome: name || "Aluno Astron",
          source: "astron_postback",
          lead_status: "aluno",
          telefone_normalized: phone,
          telefone_raw: body.phone || body.user_phone || null,
          raw_payload: body,
          ...astronFields,
          ...utmFields,
        });

      if (insertErr) {
        if (insertErr.code === "23505") {
          await supabase
            .from("lia_attendances")
            .update({ ...astronFields, ...utmFields, raw_payload: body })
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

    // ── Timeline: log Astron event into lead_activity_log ──
    const leadId = existing?.id;
    if (leadId || action === "created") {
      // For newly created leads, fetch the id
      let timelineLeadId = leadId;
      if (!timelineLeadId) {
        const { data: newLead } = await supabase
          .from("lia_attendances")
          .select("id")
          .eq("email", email)
          .limit(1)
          .maybeSingle();
        timelineLeadId = newLead?.id;
      }

      if (timelineLeadId) {
        const eventMap: Record<string, { type: string; label: string }> = {
          useradd:                     { type: "astron_user_created",    label: "Aluno cadastrado na Astron" },
          usercourseprogresschange:    { type: "astron_course_progress", label: "Progresso em curso Astron" },
          newcomment:                  { type: "astron_comment",         label: "Comentou na plataforma Astron" },
          newsupportticket:            { type: "astron_support_ticket",  label: "Abriu ticket de suporte Astron" },
          userlogin:                   { type: "astron_login",           label: "Login na Astron" },
          usercoursestart:             { type: "astron_course_start",    label: "Iniciou curso na Astron" },
          usercoursecomplete:          { type: "astron_course_complete", label: "Completou curso na Astron" },
          userlessonwatch:             { type: "astron_lesson_watch",    label: "Assistiu aula na Astron" },
        };

        const mapped = eventMap[eventType] || { type: `astron_${eventType}`, label: `Evento Astron: ${eventType}` };

        const eventData: Record<string, unknown> = {
          label: mapped.label,
          astron_event: eventType,
          astron_user_id: body.user_id || body.id || null,
        };

        // Course-specific metadata
        if (courseEntry && courseEntry.course_id) {
          eventData.course_id = courseEntry.course_id;
          eventData.course_name = courseEntry.course_name;
          eventData.percentage = courseEntry.percentage;
          eventData.completed_classes = courseEntry.completed_classes;
          eventData.total_classes = courseEntry.total_classes;
        }
        if (body.course_id) eventData.course_id = body.course_id;
        if (body.course_name) eventData.course_name = body.course_name;
        if (body.lesson_name || body.class_name) eventData.lesson_name = body.lesson_name || body.class_name;
        if (body.comment_text || body.comment) eventData.comment_text = body.comment_text || body.comment;
        if (body.ticket_subject || body.subject) eventData.ticket_subject = body.ticket_subject || body.subject;
        if (body.plans_active) eventData.plans_active = body.plans_active;

        await supabase.from("lead_activity_log").insert({
          lead_id: timelineLeadId,
          event_type: mapped.type,
          entity_type: "astron",
          entity_id: String(body.course_id || body.user_id || eventType),
          entity_name: body.course_name || body.lesson_name || mapped.label,
          event_data: eventData,
          source_channel: "astron_postback",
          event_timestamp: new Date().toISOString(),
        });

        console.log(`[astron-postback] Timeline event logged: ${mapped.type} for lead ${timelineLeadId}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true, event: eventType, email, action }),
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
