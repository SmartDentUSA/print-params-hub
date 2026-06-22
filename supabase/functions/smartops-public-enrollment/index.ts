import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  course_slug: z.string().min(1),
  turma_id: z.string().uuid().optional(),
  nome: z.string().trim().min(3).max(160),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(20),
  is_client_smartdent: z.boolean().optional(),
});

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // strip leading 55 if BR country code
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    const phone = normalizePhone(body.telefone);
    const email = body.email.toLowerCase().trim();

    // 1. Load course
    const { data: course, error: eCourse } = await supabase
      .from("smartops_courses")
      .select("id, slug, title, modality, public_enrollment_enabled, active, related_product_ids, related_product_names, stage_after_enroll, pipeline_id_kanban")
      .eq("slug", body.course_slug)
      .maybeSingle();
    if (eCourse) throw eCourse;
    if (!course || !course.active || !course.public_enrollment_enabled) {
      return new Response(JSON.stringify({ error: "course_not_available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = ["online", "online_ao_vivo", "workshop", "webinar"];
    if (!allowed.includes(course.modality)) {
      return new Response(JSON.stringify({ error: "modality_not_public" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Resolve turma (first active if not provided)
    let turmaId = body.turma_id;
    if (!turmaId) {
      const { data: t } = await supabase
        .from("smartops_course_turmas")
        .select("id")
        .eq("course_id", course.id)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      turmaId = t?.id;
    }
    if (!turmaId) {
      return new Response(JSON.stringify({ error: "no_turma_available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Find existing lead by email or phone (canonical only)
    let leadId: string | null = null;
    let isExistingClient = false;
    {
      const orFilter = `email.eq.${email},telefone.eq.${phone}`;
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, piperun_id, omie_cliente_id")
        .or(orFilter)
        .is("merged_into", null)
        .limit(1);
      if (leads && leads.length > 0) {
        leadId = leads[0].id;
        isExistingClient = Boolean(leads[0].piperun_id || leads[0].omie_cliente_id);
      }
    }

    const formName = `Inscrição — ${course.title}`;
    const productNames: string[] = Array.isArray(course.related_product_names)
      ? (course.related_product_names as string[])
      : [];

    // 4. Enrich existing lead OR create new via ingest function
    if (!leadId) {
      const ingestPayload = {
        source: "course_enrollment_public",
        form_name: formName,
        nome: body.nome,
        email,
        telefone: phone,
        origem_primeiro_contato: "Inscrição Curso",
        produto_interesse_auto: productNames[0] ?? null,
      };
      try {
        const { data: ingestRes } = await supabase.functions.invoke("smart-ops-ingest-lead", {
          body: ingestPayload,
        });
        leadId = (ingestRes as any)?.lead_id ?? (ingestRes as any)?.id ?? null;
      } catch (e) {
        console.warn("[ingest-lead]", e);
      }
      // Fallback: direct insert if ingest didn't yield a lead
      if (!leadId) {
        const { data: inserted } = await supabase
          .from("lia_attendances")
          .insert({
            nome: body.nome,
            email,
            telefone: phone,
            origem_primeiro_contato: "Inscrição Curso",
            form_name: formName,
            produto_interesse_auto: productNames[0] ?? null,
          })
          .select("id")
          .single();
        leadId = inserted?.id ?? null;
      }
    } else {
      // Best-effort enrichment (never overwrites origin)
      await supabase
        .from("lia_attendances")
        .update({
          nome: body.nome,
          email,
          telefone: phone,
          produto_interesse_auto: productNames[0] ?? null,
        })
        .eq("id", leadId)
        .is("merged_into", null)
        .then(() => {}, (e) => console.warn("[enrich]", e));
    }

    if (!leadId) {
      return new Response(JSON.stringify({ error: "lead_creation_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Conversion history
    await supabase.from("lead_conversion_history").insert({
      lead_id: leadId,
      conversion_type: "inscricao_curso",
      conversion_date: new Date().toISOString(),
      details: {
        label: `# - Inscrição [${course.title}]`,
        course_id: course.id,
        course_title: course.title,
        turma_id: turmaId,
        produtos: productNames,
        source: "public_enrollment_form",
      },
    }).then(() => {}, (e) => console.warn("[conversion]", e));

    // 6. Create enrollment
    const { data: enrollment, error: eEnroll } = await supabase
      .from("smartops_course_enrollments")
      .insert({
        course_id: course.id,
        turma_id: turmaId,
        lead_id: leadId,
        person_name: body.nome,
        status: "agendado",
        enrolled_at: new Date().toISOString(),
        source: "public",
        is_client_smartdent: isExistingClient || Boolean(body.is_client_smartdent),
        public_form_payload: {
          nome: body.nome,
          email,
          telefone: phone,
          declared_client: body.is_client_smartdent ?? null,
          ip: req.headers.get("x-forwarded-for"),
          ua: req.headers.get("user-agent"),
        },
      })
      .select("id")
      .single();
    if (eEnroll) throw eEnroll;

    // 7. Activity log
    await supabase.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: "inscricao_curso_publica",
      entity_type: "course_enrollment",
      entity_id: enrollment.id,
      entity_name: course.title,
      event_data: { turma_id: turmaId, source: "public_form" },
    }).then(() => {}, (e) => console.warn("[activity]", e));

    const showNps = isExistingClient || Boolean(body.is_client_smartdent);

    return new Response(
      JSON.stringify({
        ok: true,
        enrollment_id: enrollment.id,
        lead_id: leadId,
        is_client_smartdent: isExistingClient,
        show_nps: showNps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[public-enrollment]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});