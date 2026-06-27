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
  qualification: z
    .object({
      form_id: z.string().uuid().optional(),
      form_name: z.string().optional(),
      db_columns: z.record(z.any()).optional(),
      custom_fields: z.record(z.any()).optional(),
      form_responses: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .optional(),
      workflow_responses: z
        .array(
          z.object({
            field_id: z.string().uuid(),
            field_label: z.string(),
            value: z.string(),
            workflow_cell_target: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
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

    // Origin label for the Deal in PipeRun: prefix `#` keeps it filterable
    // alongside the other form-based origins (e.g. `# - FORMS - ...`).
    const formName = body.qualification?.form_name ?? `# - ${course.title}`;
    const productNames: string[] = Array.isArray(course.related_product_names)
      ? (course.related_product_names as string[])
      : [];

    // 4. Always run through ingest so a Deal is created on the VENDAS pipeline
    // when the user is not yet a client. The course's related products are the
    // source of truth for `produto_interesse_auto` and Workflow 7×3 cells.
    {
      const q = body.qualification ?? {};
      const ingestPayload: Record<string, any> = {
        source: "course_enrollment_public",
        form_name: formName,
        form_purpose: "sdr_captacao",
        nome: body.nome,
        email,
        telefone: phone,
        origem_primeiro_contato: formName,
        // Course's first related product overrides any inference
        produto_interesse_auto: productNames[0] ?? null,
        // Pass DB column answers (area_atuacao, especialidade, tem_scanner, etc.)
        ...(q.db_columns ?? {}),
        form_responses: q.form_responses ?? [],
      };
      const customFields = { ...(q.custom_fields ?? {}) };
      if (Object.keys(customFields).length > 0) {
        ingestPayload.raw_payload = { custom_fields: customFields };
      }
      try {
        const { data: ingestRes } = await supabase.functions.invoke("smart-ops-ingest-lead", {
          body: ingestPayload,
        });
        const ingestedId = (ingestRes as any)?.lead_id ?? (ingestRes as any)?.id ?? null;
        if (ingestedId) leadId = ingestedId;
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
            origem_primeiro_contato: formName,
            form_name: formName,
            produto_interesse_auto: productNames[0] ?? null,
          })
          .select("id")
          .single();
        leadId = inserted?.id ?? null;
      }
    }

    if (!leadId) {
      return new Response(JSON.stringify({ error: "lead_creation_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4b. Persist Workflow 7×3 mapping responses (used by SDR mapping panel).
    // The course's related products are the source of truth — the user-facing
    // answer (model owned) is appended for context.
    const wfResponses = body.qualification?.workflow_responses ?? [];
    if (wfResponses.length > 0 && body.qualification?.form_id) {
      const productSummary = productNames.length > 0 ? productNames.join(", ") : null;
      const rows = wfResponses.map((r) => ({
        form_id: body.qualification!.form_id!,
        field_id: r.field_id,
        lead_id: leadId!,
        value: productSummary ? `${productSummary} · resposta: ${r.value}` : r.value,
        workflow_cell_target: r.workflow_cell_target,
        field_label: r.field_label,
      }));
      await supabase
        .from("smartops_form_field_responses")
        .insert(rows)
        .then(() => {}, (e) => console.warn("[wf-responses]", e));
    }

    // 4c. Fire-and-forget: post a "Resumo do Lead" note on the PipeRun deal
    // mirroring the standard form ingest behaviour.
    if ((body.qualification?.form_responses?.length ?? 0) > 0) {
      supabase.functions
        .invoke("smart-ops-deal-form-note", {
          body: {
            lead_id: leadId,
            form_name: formName,
            responses: body.qualification!.form_responses,
          },
        })
        .catch((err) => console.warn("[deal-form-note]", err));
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

    // 6. Create enrollment (idempotent: reuse active enrollment for same lead+turma)
    let enrollment: { id: string } | null = null;
    {
      const { data: existing } = await supabase
        .from("smartops_course_enrollments")
        .select("id")
        .eq("turma_id", turmaId)
        .eq("lead_id", leadId)
        .not("status", "in", "(cancelado,nao_compareceu)")
        .maybeSingle();
      if (existing) {
        enrollment = existing as { id: string };
      } else {
        const { data: inserted, error: eEnroll } = await supabase
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
        if (eEnroll) {
          // Race condition: another concurrent submit landed first — reuse it
          if ((eEnroll as any).code === "23505") {
            const { data: again } = await supabase
              .from("smartops_course_enrollments")
              .select("id")
              .eq("turma_id", turmaId)
              .eq("lead_id", leadId)
              .order("enrolled_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            enrollment = (again as { id: string } | null) ?? null;
            if (!enrollment) throw eEnroll;
          } else {
            throw eEnroll;
          }
        } else {
          enrollment = inserted as { id: string };
        }
      }
    }
    if (!enrollment) throw new Error("enrollment_creation_failed");

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