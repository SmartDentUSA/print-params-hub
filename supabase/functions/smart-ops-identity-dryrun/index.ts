import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunGet } from "../_shared/piperun-field-map.ts";
import { findPersonByContact } from "../_shared/piperun-person-resolver.ts";
import {
  decide, pickActiveSeller, type CandidateDeal, type ActiveSeller,
} from "../_shared/identity-funnel-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/**
 * DRY-RUN — 100% read-only. Nenhuma escrita em Supabase nem no PipeRun.
 * Requer JWT válido (verify_jwt=true + validação em código).
 * Body: { targets: Array<{ email?: string; phone?: string; nome?: string }> }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── AuthN obrigatória ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = String(claimsData.claims.sub);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── AuthZ: apenas admin ──
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin !== true) return json({ error: "Forbidden — admin only" }, 403);

  const apiToken = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
  if (!apiToken) return json({ error: "PIPERUN_API_KEY missing" }, 500);

  let targets: Array<{ email?: string; phone?: string; nome?: string }> = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.targets)) targets = body.targets;
  } catch { /* ignore */ }
  if (targets.length === 0) return json({ error: "targets[] required" }, 400);
  if (targets.length > 200) return json({ error: "max 200 targets per call" }, 400);

  const { data: sellersRaw } = await supabase
    .from("team_members")
    .select("nome_completo, piperun_owner_id, ativo")
    .eq("ativo", true);
  const sellers: ActiveSeller[] = (sellersRaw || [])
    .map((s: Record<string, unknown>) => ({ piperun_owner_id: Number(s.piperun_owner_id), name: String(s.nome_completo ?? "") }))
    .filter((s) => Number.isFinite(s.piperun_owner_id) && s.piperun_owner_id > 0);

  const results: Array<Record<string, unknown>> = [];

  for (const t of targets) {
    const email = t.email ? String(t.email).toLowerCase().trim() : null;
    const phone = normPhone(t.phone);
    const row: Record<string, unknown> = { email, phone, nome: t.nome ?? null };

    try {
      // 1. Lead local (telefone primeiro, e-mail como fallback)
      let localLead: Record<string, unknown> | null = null;
      if (phone) {
        const { data } = await supabase.from("lia_attendances")
          .select("id, nome, email, telefone_normalized, piperun_id, pessoa_piperun_id, merged_into")
          .is("merged_into", null).ilike("telefone_normalized", `%${phone}`).limit(1);
        localLead = data?.[0] ?? null;
      }
      if (!localLead && email) {
        const { data } = await supabase.from("lia_attendances")
          .select("id, nome, email, telefone_normalized, piperun_id, pessoa_piperun_id, merged_into")
          .is("merged_into", null).eq("email", email).limit(1);
        localLead = data?.[0] ?? null;
        if (localLead) row.matched_by = "email_only";
      } else if (localLead) row.matched_by = "phone";
      row.local_lead_id = localLead?.id ?? null;

      // 2. Pessoa no PipeRun (telefone → e-mail)
      const person = await findPersonByContact(apiToken, email, t.phone ? String(t.phone) : null, supabase);
      row.person_id = person?.id ?? null;
      row.company_id = person?.company_id ?? null;

      // 3. Deals da pessoa ∪ deals da organização
      const candidates: CandidateDeal[] = [];
      const collect = (items: Array<Record<string, unknown>> | undefined, source: "person" | "company") => {
        for (const d of items || []) {
          if (d.deleted === 1 || d.deleted === true) continue;
          const pipeline = d.pipeline as Record<string, unknown> | undefined;
          const stage = d.stage as Record<string, unknown> | undefined;
          const owner = d.owner as Record<string, unknown> | undefined;
          candidates.push({
            id: Number(d.id),
            pipeline_id: pipeline?.id ? Number(pipeline.id) : (d.pipeline_id ? Number(d.pipeline_id) : null),
            pipeline_name: (pipeline?.name as string) ?? null,
            stage_name: (stage?.name as string) ?? null,
            status: (d.status as string | number) ?? null,
            owner_id: owner?.id ? Number(owner.id) : (d.owner_id ? Number(d.owner_id) : null),
            owner_name: (owner?.name as string) ?? null,
            source,
          });
        }
      };
      if (person?.id) {
        const r = await piperunGet(apiToken, "deals", { person_id: person.id, show: 50 });
        collect(((r.data as Record<string, unknown>)?.data as Array<Record<string, unknown>>), "person");
      }
      if (person?.company_id) {
        const r = await piperunGet(apiToken, "deals", { company_id: person.company_id, show: 50 });
        collect(((r.data as Record<string, unknown>)?.data as Array<Record<string, unknown>>), "company");
      }

      // 4. Decisão
      const decision = decide(candidates);
      row.action = decision.action;
      row.reason = decision.reason;
      row.deals_found = decision.classified.length;
      row.deals = decision.classified.map((d) => `${d.id}:${d.funnel}:${d.pipeline_name ?? "?"}:${d.owner_name ?? "?"}`);
      row.deals_to_close = decision.deals_to_close;
      row.deal_to_enrich = decision.deal_to_enrich;

      if (decision.needs_new_seller) {
        const pick = pickActiveSeller(sellers, decision.previous_owner_ids);
        row.would_assign_seller = pick.seller?.name ?? null;
        row.seller_pool_size = pick.pool_size;
        row.excluded_previous_owners = pick.excluded;
        row.seller_exclusion_fell_back = pick.fell_back;
      }
    } catch (e) {
      row.action = "error";
      row.reason = e instanceof Error ? e.message : String(e);
    }
    results.push(row);
  }

  const summary: Record<string, number> = {};
  for (const r of results) summary[String(r.action)] = (summary[String(r.action)] ?? 0) + 1;

  return json({ dry_run: true, wrote_anything: false, total: results.length, summary, results });
});
