import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  enrollment_id: z.string().uuid(),
  email: z.string().trim().email().max(255).optional(),
  score_satisfacao: z.number().int().min(1).max(5),
  score_treinamentos: z.number().int().min(1).max(5),
  score_recomendacao: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;

    const { data: enr } = await supabase
      .from("smartops_course_enrollments")
      .select("id, course_id, lead_id")
      .eq("id", body.enrollment_id)
      .maybeSingle();
    if (!enr) {
      return new Response(JSON.stringify({ error: "enrollment_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: eIns } = await supabase.from("smartops_nps_responses").insert({
      enrollment_id: enr.id,
      course_id: enr.course_id,
      lead_id: enr.lead_id,
      email: body.email ?? null,
      score_satisfacao: body.score_satisfacao,
      score_treinamentos: body.score_treinamentos,
      score_recomendacao: body.score_recomendacao,
      comment: body.comment ?? null,
    });
    if (eIns) throw eIns;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[public-nps]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});