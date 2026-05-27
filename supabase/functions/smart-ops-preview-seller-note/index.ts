/**
 * smart-ops-preview-seller-note
 * One-off PREVIEW endpoint — renders the seller artifacts (PipeRun HTML
 * note + WhatsApp text briefing) for a given lead WITHOUT posting
 * anything to PipeRun, Evolution, or DB. Used to validate the 7×3
 * workflow-diagnosis output before production rollout.
 *
 * GET ?email=foo@bar.com   or   ?lead_id=<uuid>   or   ?piperun_id=<id>
 *
 * verify_jwt = false (preview / dev tool).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSellerDealSummaryHTML } from "../_shared/seller-summary.ts";
import {
  diagnoseLead,
  renderDiagnosisHTML,
  renderDiagnosisWhatsApp,
  renderDiagnosisForPrompt,
} from "../_shared/workflow-diagnosis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  let email = url.searchParams.get("email");
  let lead_id = url.searchParams.get("lead_id");
  let piperun_id = url.searchParams.get("piperun_id");

  if (req.method === "POST") {
    try {
      const body = await req.json();
      email = email || body.email || null;
      lead_id = lead_id || body.lead_id || null;
      piperun_id = piperun_id || body.piperun_id || null;
    } catch { /* ignore */ }
  }

  if (!email && !lead_id && !piperun_id) {
    return new Response(
      JSON.stringify({ ok: false, error: "Provide ?email, ?lead_id or ?piperun_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve canonical lead (CDP Integrity: merged_into IS NULL)
  let q = supabase.from("lia_attendances").select("*").is("merged_into", null).limit(1);
  if (lead_id) q = q.eq("id", lead_id);
  else if (piperun_id) q = q.eq("piperun_id", String(piperun_id));
  else if (email) q = q.eq("email", String(email).toLowerCase().trim());

  const { data: leads, error } = await q;
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const lead = leads?.[0] as Record<string, unknown> | undefined;
  if (!lead) {
    return new Response(
      JSON.stringify({ ok: false, error: "Lead not found", email, lead_id, piperun_id }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Build everything in parallel
  let html = "", hash = "", waText = "", diagHtml = "", diagWa = "", diagPrompt = "";
  let diagJson: unknown = null;
  try {
    const diag = await diagnoseLead(supabase, lead, { enableLLM: true });
    diagJson = diag;
    diagHtml = renderDiagnosisHTML(diag);
    diagWa = renderDiagnosisWhatsApp(diag);
    diagPrompt = renderDiagnosisForPrompt(diag);
  } catch (e) {
    console.warn("[preview-seller-note] diagnosis error:", e);
  }

  try {
    const built = await buildSellerDealSummaryHTML(supabase, lead);
    html = built.html;
    hash = built.hash;
  } catch (e) {
    console.warn("[preview-seller-note] HTML note build error:", e);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      warning: "PREVIEW ONLY — nothing was posted to PipeRun or WhatsApp.",
      lead: {
        id: lead.id,
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone_normalized || lead.telefone_raw,
        piperun_id: lead.piperun_id,
        produto_interesse: lead.produto_interesse,
        form_name: lead.form_name,
        especialidade: lead.especialidade,
        area_atuacao: lead.area_atuacao,
      },
      diagnosis: diagJson,
      diagnosis_html: diagHtml,
      diagnosis_whatsapp_text: diagWa,
      diagnosis_prompt_block: diagPrompt,
      piperun_note_html: html,
      piperun_note_hash: hash,
    }, null, 2),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
