// cs-nps-responder — recebe a resposta pública de NPS via token opaco.
// O cliente nunca envia IDs: enrollment_id/lead_id/course_id são resolvidos aqui.
// Toda a lógica pós-insert (status, timeline, convite Google) é da trigger do banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FN = "cs-nps-responder";

const BodySchema = z.object({
  token: z.string().trim().min(16).max(200),
  score_satisfacao: z.number().int().min(1).max(5),
  score_treinamentos: z.number().int().min(1).max(5),
  score_recomendacao: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid_payload" }, 400);
    const body = parsed.data;

    const { data: enr } = await supabase
      .from("smartops_course_enrollments")
      .select("id, course_id, lead_id, email, nps_status, nps_token_expires_at")
      .eq("nps_token", body.token)
      .maybeSingle();

    if (!enr) return json({ error: "token_invalido" }, 404);
    if (enr.nps_status === "respondido") return json({ error: "token_ja_utilizado" }, 409);
    if (!enr.nps_token_expires_at || new Date(enr.nps_token_expires_at as string) <= new Date()) {
      return json({ error: "token_expirado" }, 410);
    }

    const { error: eIns } = await supabase.from("smartops_nps_responses").insert({
      enrollment_id: enr.id,
      course_id: enr.course_id,
      lead_id: enr.lead_id,
      email: enr.email ?? null,
      score_satisfacao: body.score_satisfacao,
      score_treinamentos: body.score_treinamentos,
      score_recomendacao: body.score_recomendacao,
      comment: body.comment ?? null,
    });
    if (eIns) throw eIns;

    // Mesmo critério da trigger; confirmamos lendo google_review_invited_at.
    let showGoogleInvite = body.score_recomendacao >= 4;
    const { data: after } = await supabase
      .from("smartops_course_enrollments")
      .select("google_review_invited_at")
      .eq("id", enr.id)
      .maybeSingle();
    if (after) showGoogleInvite = !!after.google_review_invited_at;

    return json({ ok: true, show_google_invite: showGoogleInvite });
  } catch (err) {
    console.error(`[${FN}]`, err);
    try {
      await supabase.from("system_health_logs").insert({
        function_name: FN, severity: "error", error_type: "internal_error",
        details: { message: String((err as Error)?.message ?? err) },
      });
    } catch { /* silencioso */ }
    return json({ error: "internal_error" }, 500);
  }
});