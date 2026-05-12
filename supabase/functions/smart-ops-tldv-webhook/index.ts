import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TLDV_API_KEY = (Deno.env.get("TLDV_API_KEY") || "").trim();
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

const TLDV_BASE = "https://pasta.tldv.io/v1alpha1";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---------- tl;dv API helpers ----------
async function tldvFetch(path: string): Promise<any> {
  const res = await fetch(`${TLDV_BASE}${path}`, {
    headers: {
      "x-api-key": TLDV_API_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`tldv ${path} ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

function transcriptToText(data: any): string {
  // tl;dv returns { id, data: [{ speaker, text, startTime }] } or { sentences: [...] }
  const items = data?.data || data?.sentences || data?.transcript || [];
  if (!Array.isArray(items)) return "";
  return items
    .map((s: any) => `${s.speaker || s.speakerName || "?"}: ${s.text || s.content || ""}`)
    .join("\n");
}

// ---------- Identity ----------
function isInternalEmail(email: string): boolean {
  const e = (email || "").toLowerCase();
  return e.endsWith("@smartdent.com.br") || e.endsWith("@smartdent.com");
}

async function resolveParticipants(meetingDbId: string, invitees: any[]): Promise<{ leadId: string | null }> {
  let leadId: string | null = null;
  for (const inv of invitees || []) {
    const email = (inv?.email || "").toLowerCase().trim();
    if (!email) continue;
    let team_member_id: string | null = null;
    let lead_id: string | null = null;
    let is_seller = false;
    let is_lead = false;

    if (isInternalEmail(email)) {
      const { data } = await supabase
        .from("team_members")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (data) {
        team_member_id = data.id;
        is_seller = true;
      }
    } else {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id")
        .eq("email", email)
        .is("merged_into", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        lead_id = data.id;
        is_lead = true;
        if (!leadId) leadId = data.id;
      }
    }

    await supabase.from("tldv_meeting_participants").insert({
      meeting_id: meetingDbId,
      email,
      name: inv?.name || null,
      role: inv?.role || null,
      lead_id,
      team_member_id,
      is_seller,
      is_lead,
    });
  }
  return { leadId };
}

// ---------- DeepSeek extraction ----------
const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_meeting_intelligence",
    description: "Extrai inteligência comercial de uma transcrição de reunião com lead odontológico.",
    parameters: {
      type: "object",
      properties: {
        produtos_mencionados: { type: "array", items: { type: "string" } },
        concorrentes_mencionados: { type: "array", items: { type: "string" } },
        equipamento_atual_scan: { type: "string", description: "Scanner que o lead já possui (marca/modelo) ou vazio" },
        equipamento_atual_imp: { type: "string", description: "Impressora 3D que o lead já possui ou vazio" },
        area_atuacao_confirmada: { type: "string" },
        especialidade_confirmada: { type: "string" },
        volume_pecas_mencionado: { type: "integer" },
        faturamento_mencionado: { type: "string" },
        sinais_compra: { type: "array", items: { type: "string" } },
        objecoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tag: { type: "string" },
              objecao: { type: "string" },
              contexto: { type: "string" },
            },
            required: ["tag", "objecao"],
          },
        },
        nivel_interesse: { type: "string", enum: ["frio", "morno", "quente", "comprador"] },
        momento_compra: { type: "string", enum: ["agora", "30d", "90d", "indefinido"] },
        orcamento_mencionado: { type: "string" },
        proximos_passos: { type: "array", items: { type: "string" } },
        follow_up_data: { type: "string", description: "ISO date YYYY-MM-DD se mencionado" },
        proposta_solicitada: { type: "boolean" },
        demo_solicitada: { type: "boolean" },
        meeting_quality_score: { type: "integer", description: "0-100" },
        resumo_executivo: { type: "string" },
        pontos_chave: { type: "array", items: { type: "string" } },
        sentiment: { type: "string", enum: ["positivo", "neutro", "negativo"] },
      },
      required: ["resumo_executivo", "nivel_interesse", "meeting_quality_score"],
    },
  },
};

async function runIntelligence(transcript: string, meetingTitle: string): Promise<any | null> {
  if (!DEEPSEEK_API_KEY) return null;
  const trimmed = transcript.slice(0, 16000);
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "Você é um Sales Intelligence da Smart Dent (odontologia digital — scanners e impressoras 3D). " +
            "Extraia APENAS o que está EXPLÍCITO na transcrição. Nunca invente nomes, valores ou produtos. " +
            "Se algo não for mencionado, omita o campo.",
        },
        {
          role: "user",
          content: `Reunião: ${meetingTitle}\n\nTranscrição:\n${trimmed}`,
        },
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "extract_meeting_intelligence" } },
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    console.error(`[tldv-webhook] DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "smart-ops-tldv-webhook",
    actionLabel: "extract-meeting-intelligence",
    model: "deepseek-chat",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });
  const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return null;
  try {
    return JSON.parse(tc.function.arguments);
  } catch {
    return null;
  }
}

// ---------- Lead enrichment ----------
async function enrichLead(leadId: string, intel: any) {
  const update: Record<string, unknown> = {};
  if (intel.equipamento_atual_scan) update.equip_scanner = intel.equipamento_atual_scan;
  if (intel.equipamento_atual_imp) update.equip_impressora = intel.equipamento_atual_imp;
  if (intel.area_atuacao_confirmada) update.area_atuacao = intel.area_atuacao_confirmada;
  if (intel.especialidade_confirmada) update.especialidade = intel.especialidade_confirmada;
  // NEVER touch origem_primeiro_contato (Person Origin Frozen)
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("lia_attendances")
    .update(update)
    .eq("id", leadId)
    .is("merged_into", null);
  if (error) console.error(`[tldv-webhook] enrichLead error:`, error.message);
}

// ---------- Main processor ----------
async function processMeeting(tldvId: string, eventType: string): Promise<{ ok: boolean; meeting_id?: string; error?: string }> {
  // 1. Fetch meeting metadata
  let meta: any;
  try {
    meta = await tldvFetch(`/meetings/${tldvId}`);
  } catch (e) {
    return { ok: false, error: `meta fetch: ${(e as Error).message}` };
  }

  // 2. Fetch transcript
  let transcript: any = null;
  let transcriptText = "";
  try {
    transcript = await tldvFetch(`/meetings/${tldvId}/transcript`);
    transcriptText = transcriptToText(transcript);
  } catch (e) {
    console.warn(`[tldv-webhook] no transcript for ${tldvId}: ${(e as Error).message}`);
  }

  // 3. Fetch highlights (optional)
  let highlights: any = null;
  try {
    highlights = await tldvFetch(`/meetings/${tldvId}/highlights`);
  } catch {
    /* ignore */
  }

  const invitees: any[] = meta?.invitees || meta?.attendees || [];
  const organizer = meta?.organizer || invitees[0] || {};

  // 4. Upsert meeting
  const { data: meetingRow, error: upErr } = await supabase
    .from("tldv_meetings")
    .upsert(
      {
        tldv_id: String(tldvId),
        name: meta?.name || meta?.title || null,
        happened_at: meta?.happenedAt || meta?.startTime || meta?.created_at || null,
        duration_seconds: meta?.duration || meta?.durationSeconds || null,
        platform: meta?.platform || null,
        url: meta?.url || meta?.shareUrl || null,
        organizer_email: organizer?.email || null,
        organizer_name: organizer?.name || null,
        invitees,
        status: eventType || meta?.status || "transcript_ready",
        raw_transcript: transcript,
        raw_highlights: highlights,
        transcript_text: transcriptText || null,
        language: transcript?.language || meta?.language || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tldv_id" }
    )
    .select("id")
    .single();

  if (upErr || !meetingRow) {
    return { ok: false, error: `upsert meeting: ${upErr?.message}` };
  }

  const meetingDbId = meetingRow.id;

  // 5. Reset participants and re-resolve
  await supabase.from("tldv_meeting_participants").delete().eq("meeting_id", meetingDbId);
  const { leadId } = await resolveParticipants(meetingDbId, invitees);

  // 6. Run AI if we have transcript
  if (transcriptText.length > 200) {
    const intel = await runIntelligence(transcriptText, meta?.name || meta?.title || "");
    if (intel) {
      // upsert intelligence row (1:1 with meeting)
      await supabase.from("tldv_meeting_intelligence").delete().eq("meeting_id", meetingDbId);
      await supabase.from("tldv_meeting_intelligence").insert({
        meeting_id: meetingDbId,
        lead_id: leadId,
        produtos_mencionados: intel.produtos_mencionados || null,
        concorrentes_mencionados: intel.concorrentes_mencionados || null,
        equipamento_atual_scan: intel.equipamento_atual_scan || null,
        equipamento_atual_imp: intel.equipamento_atual_imp || null,
        area_atuacao_confirmada: intel.area_atuacao_confirmada || null,
        especialidade_confirmada: intel.especialidade_confirmada || null,
        volume_pecas_mencionado: intel.volume_pecas_mencionado || null,
        faturamento_mencionado: intel.faturamento_mencionado || null,
        sinais_compra: intel.sinais_compra || null,
        objecoes: intel.objecoes || null,
        objecoes_tags: (intel.objecoes || []).map((o: any) => o?.tag).filter(Boolean),
        nivel_interesse: intel.nivel_interesse || null,
        momento_compra: intel.momento_compra || null,
        orcamento_mencionado: intel.orcamento_mencionado || null,
        proximos_passos: intel.proximos_passos || null,
        follow_up_data: intel.follow_up_data || null,
        proposta_solicitada: intel.proposta_solicitada ?? null,
        demo_solicitada: intel.demo_solicitada ?? null,
        meeting_quality_score: intel.meeting_quality_score ?? null,
        resumo_executivo: intel.resumo_executivo || null,
        pontos_chave: intel.pontos_chave || null,
        sentiment: intel.sentiment || null,
        ai_model: "deepseek-chat",
        analyzed_at: new Date().toISOString(),
        analysis_version: 1,
      });

      // 7. Enrich lead
      if (leadId) await enrichLead(leadId, intel);
    }
  }

  return { ok: true, meeting_id: meetingDbId };
}

// ---------- HTTP entrypoint ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const eventType: string = body.event || body.type || body.eventType || "TranscriptReady";
    // tl;dv payload shapes vary — try common locations
    const tldvId: string | undefined =
      body.meetingId || body.meeting_id || body.id || body.data?.meetingId || body.data?.id;

    // Always log raw webhook
    const { data: logRow } = await supabase
      .from("tldv_webhook_log")
      .insert({
        event_type: eventType,
        tldv_id: tldvId ? String(tldvId) : null,
        payload: body,
        processed: false,
      })
      .select("id")
      .single();

    if (!tldvId) {
      return new Response(JSON.stringify({ error: "no tldv meeting id in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await processMeeting(String(tldvId), eventType);

    if (logRow?.id) {
      await supabase
        .from("tldv_webhook_log")
        .update({ processed: result.ok, error: result.ok ? null : result.error || null })
        .eq("id", logRow.id);
    }

    console.log(`[tldv-webhook] ${tldvId} → ${result.ok ? "ok" : "err"} ${result.error || ""}`);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[tldv-webhook] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
