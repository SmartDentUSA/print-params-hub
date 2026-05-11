import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunGet, piperunPost, piperunPut } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function deriveNomeFromRaw(lead: Record<string, unknown>): string | null {
  const rp = (lead.raw_payload as Record<string, unknown> | null) || {};
  const latest = (rp.latest_payload as Record<string, unknown> | undefined) || {};
  const candidates = [
    latest.full_name, latest.nome_completo, latest.nome, latest.name,
    [latest.first_name, latest.last_name].filter(Boolean).join(" ").trim() || null,
  ].filter((v) => typeof v === "string" && (v as string).trim().length >= 3);
  if (candidates.length) return String(candidates[0]).trim();
  // Fallback: humanize email local-part
  const email = lead.email as string | null;
  if (email) {
    const local = email.split("@")[0] || "";
    const humanized = local.replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
    if (humanized.length >= 2) {
      return humanized.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* GET / empty */ }
    const dryRun = body.dry_run !== false; // default TRUE
    const limit = Number(body.limit ?? 50);
    const explicitIds = Array.isArray(body.lead_ids) ? body.lead_ids as string[] : null;
    const scope = (body.scope as string) || "heitor"; // 'heitor' | 'shared_hash' | 'ids'

    // ─── 1. Build candidate list ───
    let candidates: Array<Record<string, unknown>> = [];
    if (explicitIds && explicitIds.length) {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, telefone_normalized, telefone_raw, piperun_id, pessoa_piperun_id, pessoa_hash, raw_payload")
        .in("id", explicitIds);
      candidates = (data as any[]) || [];
    } else if (scope === "shared_hash") {
      // Find pessoa_hash values shared between ≥2 canonical leads with different emails
      const { data: dups } = await supabase.rpc("exec_sql_readonly", { sql: "" }).catch(() => ({ data: null }));
      // Fallback: do it client-side
      const { data: all } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, telefone_normalized, telefone_raw, piperun_id, pessoa_piperun_id, pessoa_hash, raw_payload")
        .not("pessoa_hash", "is", null)
        .is("merged_into", null)
        .limit(5000);
      const byHash = new Map<string, any[]>();
      for (const row of (all as any[]) || []) {
        const h = String(row.pessoa_hash);
        if (!byHash.has(h)) byHash.set(h, []);
        byHash.get(h)!.push(row);
      }
      for (const [, group] of byHash) {
        if (group.length < 2) continue;
        const emails = new Set(group.map((r) => String(r.email || "").toLowerCase()).filter(Boolean));
        if (emails.size < 2) continue;
        // Keep all but the oldest (assume oldest is the legitimate one)
        group.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        candidates.push(...group.slice(1));
      }
      candidates = candidates.slice(0, limit);
    } else {
      // Default scope: known Heitor contamination
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, telefone_normalized, telefone_raw, piperun_id, pessoa_piperun_id, pessoa_hash, raw_payload")
        .is("merged_into", null)
        .ilike("nome", "%heitor%rabeti%")
        .not("email", "ilike", "%heitor%")
        .not("email", "ilike", "%rabet%")
        .limit(limit);
      candidates = (data as any[]) || [];
    }

    const report: Array<Record<string, unknown>> = [];

    for (const lead of candidates) {
      const correctNome = deriveNomeFromRaw(lead) || (lead.nome as string) || null;
      const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
      const email = lead.email as string | null;
      const action: Record<string, unknown> = {
        lead_id: lead.id,
        current_nome: lead.nome,
        email,
        phone,
        current_pessoa_piperun_id: lead.pessoa_piperun_id,
        current_pessoa_hash: lead.pessoa_hash,
        new_nome: correctNome,
        piperun_id: lead.piperun_id,
      };

      if (dryRun) {
        report.push({ ...action, dry_run: true });
        continue;
      }

      if (!correctNome || !email) {
        report.push({ ...action, status: "skipped", reason: "missing_identity" });
        continue;
      }

      // 2a. Create new person in PipeRun
      const personPayload: Record<string, unknown> = { name: correctNome, emails: [{ email }] };
      if (phone) personPayload.phones = [{ phone }];
      const createRes = await piperunPost(PIPERUN_API_KEY, "persons", personPayload);
      if (!createRes.success) {
        report.push({ ...action, status: "person_create_failed", piperun_status: createRes.status, body: createRes.data });
        continue;
      }
      const newPersonId = Number(((createRes.data as any)?.data?.id) || 0);
      const newPersonHash = ((createRes.data as any)?.data?.hash) || null;
      if (!newPersonId) {
        report.push({ ...action, status: "person_create_no_id", body: createRes.data });
        continue;
      }

      // 2b. Re-attach deal to new person (and detach from wrong company)
      if (lead.piperun_id) {
        const putRes = await piperunPut(
          PIPERUN_API_KEY,
          `deals/${lead.piperun_id}`,
          { person_id: newPersonId, company_id: null, title: `${correctNome} - reparo identidade` },
        );
        if (!putRes.success) {
          report.push({ ...action, status: "deal_attach_failed", new_person_id: newPersonId, piperun_status: putRes.status });
          continue;
        }
      }

      // 2c. Update local row
      const { error: updErr } = await supabase
        .from("lia_attendances")
        .update({
          nome: correctNome,
          pessoa_piperun_id: newPersonId,
          pessoa_hash: newPersonHash,
          empresa_piperun_id: null,
          empresa_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      if (updErr) {
        report.push({ ...action, status: "local_update_failed", new_person_id: newPersonId, error: updErr.message });
        continue;
      }

      // 2d. Audit log
      await supabase.from("lead_activity_log").insert({
        lead_id: lead.id,
        event_type: "piperun_person_detached",
        entity_type: "piperun_person",
        entity_name: `Detached from ${lead.pessoa_piperun_id} → ${newPersonId}`,
        message: `Identity repair: ${lead.nome} → ${correctNome}`,
        details: {
          old_pessoa_piperun_id: lead.pessoa_piperun_id,
          old_pessoa_hash: lead.pessoa_hash,
          new_pessoa_piperun_id: newPersonId,
          new_pessoa_hash: newPersonHash,
          deal_id: lead.piperun_id,
        },
      });

      report.push({ ...action, status: "ok", new_person_id: newPersonId, new_person_hash: newPersonHash });
      // Pacing
      await new Promise((r) => setTimeout(r, 350));
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      scope,
      total_candidates: candidates.length,
      report,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[detach-wrong-person] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
