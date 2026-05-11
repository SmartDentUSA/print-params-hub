import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findPersonByEmail, findPersonDeals } from "../_shared/piperun-hierarchy.ts";
import { piperunGet } from "../_shared/piperun-field-map.ts";
import { PIPELINES } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Piperun Preflight — read-only audit before retry/backfill.
 * Body: { emails: string[] }
 * Returns per email: local_piperun_id, piperun_person_id, open Vendas/Estagn deal,
 * won deals, recommended action.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let emails: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.emails)) {
      emails = body.emails.map((e: string) => String(e).toLowerCase().trim()).filter(Boolean);
    }
  } catch {}
  if (emails.length === 0) {
    return new Response(JSON.stringify({ error: "emails[] required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  emails = [...new Set(emails)].slice(0, 500);

  // Debug mode: return raw Piperun response for first email
  let debug: unknown = null;

  // Local lookup (chunked)
  const localByEmail = new Map<string, { id: string; piperun_id: string | null; pessoa_piperun_id: number | null }>();
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, email, piperun_id, pessoa_piperun_id, merged_into")
      .in("email", chunk)
      .is("merged_into", null);
    for (const r of (data || []) as any[]) {
      const e = String(r.email || "").toLowerCase();
      if (e && !localByEmail.has(e)) localByEmail.set(e, r);
    }
  }

  type Row = {
    email: string;
    local_lead_id: string | null;
    local_piperun_id: string | null;
    piperun_person_id: number | null;
    open_vendas_deal: string | null;
    open_estagn_deal: string | null;
    won_deals: number;
    other_open_deals: number;
    action: "skip_local_id_present" | "skip_open_deal_exists" | "skip_won_only" | "safe_create" | "person_not_found";
  };
  const rows: Row[] = [];

  for (const email of emails) {
    const local = localByEmail.get(email) || null;
    if (debug === null && emails.length === 1) {
      const r1 = await piperunGet(PIPERUN_API_KEY, "persons", { show: 50 }, { "emails[email]": [email] });
      const r2 = await piperunGet(PIPERUN_API_KEY, "persons", { search: email, show: 50 });
      const items1 = ((r1.data as any)?.data as any[]) || [];
      const items2 = ((r2.data as any)?.data as any[]) || [];
      debug = {
        email,
        emails_email_filter: { count: items1.length, first: items1.slice(0, 3).map((p) => ({ id: p.id, name: p.name, emails: p.emails })) },
        search_filter: { count: items2.length, first: items2.slice(0, 3).map((p) => ({ id: p.id, name: p.name, emails: p.emails })) },
      };
    }
    const row: Row = {
      email,
      local_lead_id: local?.id ?? null,
      local_piperun_id: local?.piperun_id ?? null,
      piperun_person_id: null,
      open_vendas_deal: null,
      open_estagn_deal: null,
      won_deals: 0,
      other_open_deals: 0,
      action: "safe_create",
    };

    try {
      const person = await findPersonByEmail(PIPERUN_API_KEY, email);
      if (!person) {
        row.action = local?.piperun_id ? "skip_local_id_present" : "person_not_found";
        rows.push(row);
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      row.piperun_person_id = person.id;

      const deals = await findPersonDeals(PIPERUN_API_KEY, person.id);
      const open = deals.filter((d) => Number(d.status) === 0);
      const won = deals.filter((d) => Number(d.status) === 1);
      const vendas = open.find((d) => Number(d.pipeline_id) === PIPELINES.VENDAS);
      const estagn = open.find((d) => Number(d.pipeline_id) === PIPELINES.ESTAGNADOS);
      row.open_vendas_deal = vendas ? String(vendas.id) : null;
      row.open_estagn_deal = estagn ? String(estagn.id) : null;
      row.won_deals = won.length;
      row.other_open_deals = open.length - (vendas ? 1 : 0) - (estagn ? 1 : 0);

      if (local?.piperun_id) row.action = "skip_local_id_present";
      else if (vendas || estagn) row.action = "skip_open_deal_exists";
      else if (won.length > 0 && open.length === 0) row.action = "skip_won_only";
      else row.action = "safe_create";
    } catch (e) {
      console.warn("[preflight] error for", email, e);
    }

    rows.push(row);
    await new Promise((r) => setTimeout(r, 150)); // rate-limit Piperun
  }

  const summary = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {});

  // CSV
  const headers = [
    "email","local_lead_id","local_piperun_id","piperun_person_id",
    "open_vendas_deal","open_estagn_deal","won_deals","other_open_deals","action",
  ];
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => {
      const v = (r as any)[h];
      return v === null || v === undefined ? "" : String(v);
    }).join(",")))
    .join("\n");

  return new Response(JSON.stringify({
    total: rows.length,
    summary,
    rows,
    csv,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});