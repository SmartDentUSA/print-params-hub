// smart-ops-raffle-entry — participação pública em sorteio de evento.
// Valida regras configuradas no editor, grava a participação e encaminha o lead
// ao fluxo normal de leads (smart-ops-ingest-lead), com o consultor do estande
// como responsável quando informado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizePhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : "55" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || "").trim();
    const answers = (body?.answers && typeof body.answers === "object") ? body.answers as Record<string, unknown> : {};
    const name = String(body?.name || answers.nome || "").trim();
    const email = String(body?.email || answers.email || "").trim().toLowerCase() || null;
    const phone = normalizePhone(String(body?.phone || answers.telefone || ""));
    const consent = body?.consent === true;
    const sellerId = body?.seller_team_member_id ? String(body.seller_team_member_id) : null;

    if (!slug) return json({ ok: false, error: "slug_required" }, 400);
    if (!name) return json({ ok: false, error: "name_required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: raffle } = await supabase
      .from("event_raffles")
      .select("id, event_id, name, status, starts_at, ends_at, eligibility")
      .eq("slug", slug)
      .maybeSingle();

    if (!raffle) return json({ ok: false, error: "raffle_not_found" }, 404);
    if (raffle.status !== "active") return json({ ok: false, error: "raffle_not_active" }, 400);

    const now = Date.now();
    if (raffle.starts_at && now < new Date(raffle.starts_at).getTime()) {
      return json({ ok: false, error: "raffle_not_started" }, 400);
    }
    if (raffle.ends_at && now > new Date(raffle.ends_at).getTime()) {
      return json({ ok: false, error: "raffle_ended" }, 400);
    }

    const rules = (raffle.eligibility || {}) as Record<string, any>;
    if (rules.require_consent && !consent) return json({ ok: false, error: "consent_required" }, 400);
    if (rules.require_contact !== false && !phone && !email) return json({ ok: false, error: "contact_required" }, 400);
    if (rules.require_stand_visit && !sellerId) return json({ ok: false, error: "consultant_required" }, 400);

    // Uma participação por telefone (padrão). Regra desligável no editor.
    if (phone && rules.one_entry_per_person !== false) {
      const { data: dup } = await supabase
        .from("event_raffle_entries")
        .select("id")
        .eq("raffle_id", raffle.id)
        .eq("phone", phone)
        .maybeSingle();
      if (dup) return json({ ok: true, duplicate: true, entry_id: dup.id });
    }

    const weights = (rules.weights || {}) as Record<string, number>;
    let tickets = Number(weights.form ?? 1) || 1;
    if (sellerId) tickets += Number(weights.stand_visit ?? 0) || 0;

    const { data: entry, error } = await supabase
      .from("event_raffle_entries")
      .insert({
        raffle_id: raffle.id,
        name,
        email,
        phone,
        answers,
        consent,
        tickets,
        seller_team_member_id: sellerId,
        source: "form",
      })
      .select("id")
      .single();

    if (error) return json({ ok: false, error: error.message }, 500);

    // Lead entra no fluxo normal (mesma regra dos formulários de evento).
    try {
      const formResponses = Object.entries(answers)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => ({ label: k, value: Array.isArray(v) ? v.join(", ") : String(v) }));

      const ingest = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-ingest-lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          nome: name,
          email,
          telefone: phone,
          source: "formulario",
          form_name: `# - [SORTEIO] - ${raffle.name}`,
          form_purpose: "feira_evento",
          event_id: raffle.event_id,
          proprietario_lead_crm: sellerId,
          event_consultant_team_member_id: sellerId,
          form_responses: [{ label: "Sorteio", value: raffle.name }, ...formResponses],
          ...answers,
        }),
      });
      const ing = await ingest.json().catch(() => ({}));
      if (ing?.lead_id || ing?.attendance_id) {
        await supabase
          .from("event_raffle_entries")
          .update({ lead_id: ing.lead_id ?? ing.attendance_id })
          .eq("id", entry.id);
      }
    } catch (e) {
      console.error("[raffle-entry] ingest failed", String((e as Error)?.message ?? e));
    }

    return json({ ok: true, entry_id: entry.id });
  } catch (e) {
    console.error("[raffle-entry] error", String((e as Error)?.message ?? e));
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
