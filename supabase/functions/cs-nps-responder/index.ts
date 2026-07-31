// cs-nps-responder — recebe a resposta pública de NPS via token opaco.
// O cliente nunca envia IDs: enrollment_id/lead_id/course_id são resolvidos aqui.
// Toda a lógica pós-insert (status, timeline, convite Google) é da trigger do banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { addDealNote } from "../_shared/piperun-field-map.ts";

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

// Tela 2b: relato adicional do participante insatisfeito (mesmo token).
const FollowUpSchema = z.object({
  token: z.string().trim().min(16).max(200),
  follow_up_comment: z.string().trim().min(1).max(2000),
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
    const raw = await req.json().catch(() => null);

    const followUp = FollowUpSchema.safeParse(raw);
    if (followUp.success) {
      const { data: e2 } = await supabase
        .from("smartops_course_enrollments")
        .select("id")
        .eq("nps_token", followUp.data.token)
        .maybeSingle();
      if (!e2) return json({ error: "token_invalido" }, 404);
      const { data: resp } = await supabase
        .from("smartops_nps_responses")
        .select("id, comment")
        .eq("enrollment_id", e2.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!resp) return json({ error: "resposta_nao_encontrada" }, 404);
      const merged = [resp.comment, followUp.data.follow_up_comment]
        .map((v) => (v ?? "").toString().trim())
        .filter(Boolean)
        .join("\n---\n");
      const { error: eUpd } = await supabase
        .from("smartops_nps_responses")
        .update({ comment: merged })
        .eq("id", resp.id);
      if (eUpd) throw eUpd;
      return json({ ok: true });
    }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_payload" }, 400);
    const body = parsed.data;

    const { data: enr } = await supabase
      .from("smartops_course_enrollments")
      .select("id, course_id, lead_id, nps_status, nps_token_expires_at")
      .eq("nps_token", body.token)
      .maybeSingle();

    if (!enr) return json({ error: "token_invalido" }, 404);
    if (enr.nps_status === "respondido") return json({ error: "token_ja_utilizado" }, 409);
    if (!enr.nps_token_expires_at || new Date(enr.nps_token_expires_at as string) <= new Date()) {
      return json({ error: "token_expirado" }, 410);
    }

    let leadEmail: string | null = null;
    if (enr.lead_id) {
      const { data: lead } = await supabase
        .from("lia_attendances")
        .select("email")
        .eq("id", enr.lead_id)
        .maybeSingle();
      leadEmail = (lead?.email as string | null) ?? null;
    }

    const { error: eIns } = await supabase.from("smartops_nps_responses").insert({
      enrollment_id: enr.id,
      course_id: enr.course_id,
      lead_id: enr.lead_id,
      email: leadEmail,
      score_satisfacao: body.score_satisfacao,
      score_treinamentos: body.score_treinamentos,
      score_recomendacao: body.score_recomendacao,
      comment: body.comment ?? null,
    });
    if (eIns) throw eIns;

    // Espelha a nota de NPS no deal do PipeRun (best-effort, não bloqueia a resposta).
    try {
      const apiToken = Deno.env.get("PIPERUN_API_KEY");
      if (apiToken && enr.lead_id) {
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("nome, piperun_id")
          .eq("id", enr.lead_id)
          .maybeSingle();
        const dealId = Number(lead?.piperun_id);
        if (dealId && Number.isFinite(dealId)) {
          const nps10 = body.score_recomendacao * 2;
          const classificacao = nps10 >= 9 ? "Promotor" : nps10 >= 7 ? "Neutro" : "Detrator";
          const note = [
            "<b>⭐ NPS pós-treinamento</b>",
            `NPS: <b>${nps10}/10</b> (${classificacao})`,
            `Satisfação geral: ${body.score_satisfacao}/5`,
            `Treinamentos: ${body.score_treinamentos}/5`,
            `Recomendação: ${body.score_recomendacao}/5`,
            body.comment ? `Comentário: ${body.comment}` : null,
          ].filter(Boolean).join("<br>");
          const res = await addDealNote(apiToken, dealId, note);
          if (!res.success) {
            console.warn(`[${FN}] piperun note failed`, JSON.stringify(res.data).slice(0, 300));
          }
        }
      }
    } catch (e) {
      console.warn(`[${FN}] piperun note error`, String(e));
    }

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