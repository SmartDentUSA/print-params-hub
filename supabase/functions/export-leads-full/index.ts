// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};

const PAGE = 1000;

async function fetchAll(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select = "*",
  applyFilter?: (q: any) => any,
): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) {
      console.error(`[export-leads-full] ${table} error:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function flattenValue(v: any): any {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return v;
}

function csvEscape(v: any): string {
  const s = String(flattenValue(v) ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: any[]): string {
  if (!rows.length) return "(no data)\n";
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r ?? {})) keys.add(k);
  const cols = [...keys];
  const lines: string[] = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((k) => csvEscape(r?.[k])).join(","));
  return lines.join("\n");
}

function expandDeals(leads: any[]) {
  const deals: any[] = [];
  const proposals: any[] = [];
  const items: any[] = [];
  for (const lead of leads) {
    const hist = Array.isArray(lead.piperun_deals_history) ? lead.piperun_deals_history : [];
    for (const d of hist) {
      if (!d || typeof d !== "object") continue;
      deals.push({
        lead_id: lead.id,
        email: lead.email,
        nome: lead.nome,
        deal_id: d.deal_id,
        deal_hash: d.deal_hash,
        deal_title: d.deal_title,
        pipeline_id: d.pipeline_id,
        pipeline_name: d.pipeline_name,
        stage_id: d.stage_id,
        stage_name: d.stage_name,
        owner_id: d.owner_id,
        owner_name: d.owner_name,
        owner_email: d.owner_email,
        origem: d.origem,
        status: d.status,
        value: d.value,
        value_mrr: d.value_mrr,
        value_freight: d.value_freight,
        value_products: d.value_products,
        product: d.product,
        person_id: d.person_id,
        company_id: d.company_id,
        created_at: d.created_at,
        closed_at: d.closed_at,
        synced_at: d.synced_at,
      });
      const props = Array.isArray(d.proposals) ? d.proposals : [];
      for (const p of props) {
        proposals.push({
          lead_id: lead.id,
          email: lead.email,
          deal_id: d.deal_id,
          proposal_id: p.id,
          sigla: p.sigla,
          status: p.status,
          parcelas: p.parcelas,
          valor_ps: p.valor_ps,
          valor_mrr: p.valor_mrr,
          valor_frete: p.valor_frete,
          tipo_frete: p.tipo_frete,
          vendedor: p.vendedor,
        });
        const its = Array.isArray(p.items) ? p.items : [];
        for (const it of its) {
          items.push({
            lead_id: lead.id,
            email: lead.email,
            deal_id: d.deal_id,
            proposal_id: p.id,
            sku: it.sku,
            item_id: it.item_id,
            nome: it.nome,
            tipo: it.tipo,
            categoria: it.categoria,
            qtd: it.qtd,
            unit: it.unit,
            total: it.total,
          });
        }
      }
    }
  }
  return { deals, proposals, items };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: require admin ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isAdminData, error: adminErr } = await supabase.rpc("is_admin", { user_id: userData.user.id });
    if (adminErr || !isAdminData) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[export-leads-full] Starting full export…");

    // ── Fetch canonical leads (CDP integrity) ──
    const leads = await fetchAll(supabase, "lia_attendances", "*", (q) => q.is("merged_into", null));
    console.log(`[export-leads-full] leads=${leads.length}`);
    const leadIds = leads.map((l) => l.id);

    // Helper: chunked filter on lead_id
    async function fetchByLeadIds(table: string, idCol = "lead_id"): Promise<any[]> {
      if (!leadIds.length) return [];
      const all: any[] = [];
      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        const rows = await fetchAll(supabase, table, "*", (q) => q.in(idCol, chunk));
        all.push(...rows);
      }
      return all;
    }

    const { deals, proposals, items } = expandDeals(leads);

    // Parallel fetches for related tables (best-effort: ignore tables that error)
    const safeFetch = async (table: string, idCol = "lead_id") => {
      try { return await fetchByLeadIds(table, idCol); }
      catch (e) { console.warn(`[export-leads-full] ${table} skipped:`, (e as Error).message); return []; }
    };
    const safeAll = async (table: string, filter?: (q: any) => any) => {
      try { return await fetchAll(supabase, table, "*", filter); }
      catch (e) { console.warn(`[export-leads-full] ${table} skipped:`, (e as Error).message); return []; }
    };

    const [
      timeline, stateEvents, pageViews, conversions, opportunities,
      formSubs, cartHist, productHist, courseProg, sdrInter,
      activityLog, enrichAudit,
      vCognitive, vCommercial, vEcommerce, vFinanceiro, vAcademy,
    ] = await Promise.all([
      safeFetch("v_lead_timeline"),
      safeFetch("lead_state_events"),
      safeFetch("lead_page_views"),
      safeFetch("lead_conversion_history"),
      safeFetch("lead_opportunities"),
      safeFetch("lead_form_submissions"),
      safeFetch("lead_cart_history"),
      safeFetch("lead_product_history"),
      safeFetch("lead_course_progress"),
      safeFetch("lead_sdr_interactions"),
      safeFetch("lead_activity_log"),
      safeFetch("lead_enrichment_audit"),
      safeFetch("v_lead_cognitive"),
      safeFetch("v_lead_commercial"),
      safeFetch("v_lead_ecommerce"),
      safeFetch("v_lead_financeiro"),
      safeFetch("v_lead_academy"),
    ]);

    // ── Build CSV ZIP (memory-efficient vs XLSX) ──
    const files: Record<string, Uint8Array> = {};
    const append = (name: string, rows: any[]) => {
      files[`${name}.csv`] = strToU8(rowsToCsv(rows));
    };

    append("Leads", leads);
    append("Deals", deals);
    append("Proposals", proposals);
    append("Proposal_Items", items);
    append("Timeline", timeline);
    append("State_Events", stateEvents);
    append("Page_Views", pageViews);
    append("Conversions", conversions);
    append("Opportunities", opportunities);
    append("Form_Submissions", formSubs);
    append("Cart_History", cartHist);
    append("Product_History", productHist);
    append("Course_Progress", courseProg);
    append("SDR_Interactions", sdrInter);
    append("Activity_Log", activityLog);
    append("Enrichment_Audit", enrichAudit);
    append("Cognitive_View", vCognitive);
    append("Commercial_View", vCommercial);
    append("Ecommerce_View", vEcommerce);
    append("Financeiro_View", vFinanceiro);
    append("Academy_View", vAcademy);

    const zipped = zipSync(files, { level: 6 });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `smartdent-leads-export-${date}.zip`;

    console.log(`[export-leads-full] Done leads=${leads.length} deals=${deals.length} bytes=${zipped.byteLength}`);

    return new Response(zipped, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Lead-Count": String(leads.length),
        "X-Deal-Count": String(deals.length),
      },
    });
  } catch (err) {
    console.error("[export-leads-full] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});