import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { addDealNote } from "../_shared/piperun-field-map.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  enrollment_id: z.string().uuid(),
  email: z.string().trim().email().max(255).optional(),
  survey_type: z.enum(["pos_treinamento", "demonstracao_ao_vivo"]).optional(),
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
      survey_type: body.survey_type ?? "pos_treinamento",
      score_satisfacao: body.score_satisfacao,
      score_treinamentos: body.score_treinamentos,
      score_recomendacao: body.score_recomendacao,
      comment: body.comment ?? null,
    });
    if (eIns) throw eIns;

    // Timeline: NPS answers belong to the lead's single source of truth.
    if (enr.lead_id) {
      const media = (
        (body.score_satisfacao + body.score_treinamentos + body.score_recomendacao) / 3
      ).toFixed(1);
      const surveyType = body.survey_type ?? "pos_treinamento";
      const surveyLabel =
        surveyType === "demonstracao_ao_vivo"
          ? "NPS Demonstrações ao Vivo"
          : "NPS pós-treinamento";
      await supabase
        .from("lead_activity_log")
        .insert({
          lead_id: enr.lead_id,
          event_type: "nps_respondido",
          entity_type: "course_enrollment",
          entity_id: enr.id,
          entity_name: surveyLabel,
          source_channel: "formulario_publico",
          value_numeric: Number(media),
          event_data: {
            survey_type: surveyType,
            score_satisfacao: body.score_satisfacao,
            score_treinamentos: body.score_treinamentos,
            score_recomendacao: body.score_recomendacao,
            comment: body.comment ?? null,
            description: [
              `${surveyLabel} respondido (média ${media})`,
              `Satisfação: ${body.score_satisfacao}`,
              `Treinamentos: ${body.score_treinamentos}`,
              `Recomendação: ${body.score_recomendacao}`,
              ...(body.comment ? [`Observação: ${body.comment}`] : []),
            ].join("\n"),
          },
        })
        .then(() => {}, (e) => console.warn("[nps-activity]", e));
    }

    // Marca a matrícula como respondida (evita reenvio de cobrança de NPS).
    await supabase
      .from("smartops_course_enrollments")
      .update({ nps_status: "respondido" })
      .eq("id", enr.id)
      .then(() => {}, (e) => console.warn("[nps-status]", e));

    // Espelha a nota de NPS no deal do PipeRun (best-effort).
    try {
      const apiToken = Deno.env.get("PIPERUN_API_KEY");
      if (apiToken && enr.lead_id) {
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("piperun_id")
          .eq("id", enr.lead_id)
          .maybeSingle();
        const dealId = Number(lead?.piperun_id);
        if (dealId && Number.isFinite(dealId)) {
          const surveyType = body.survey_type ?? "pos_treinamento";
          const label =
            surveyType === "demonstracao_ao_vivo"
              ? "NPS Demonstrações ao Vivo"
              : "NPS pós-treinamento";
          const nps10 = body.score_recomendacao * 2;
          const classificacao = nps10 >= 9 ? "Promotor" : nps10 >= 7 ? "Neutro" : "Detrator";
          const note = [
            `<b>⭐ ${label}</b>`,
            `NPS: <b>${nps10}/10</b> (${classificacao})`,
            `Satisfação geral: ${body.score_satisfacao}/5`,
            `Treinamentos/conteúdos: ${body.score_treinamentos}/5`,
            `Recomendação: ${body.score_recomendacao}/5`,
            body.comment ? `Comentário: ${body.comment}` : null,
          ].filter(Boolean).join("<br>");
          const res = await addDealNote(apiToken, dealId, note);
          if (!res.success) console.warn("[nps-piperun-note]", JSON.stringify(res.data).slice(0, 300));
        }
      }
    } catch (e) {
      console.warn("[nps-piperun-note]", String(e));
    }


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