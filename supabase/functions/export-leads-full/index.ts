// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE = 1000;
const BUCKET = "admin-exports";

function flattenValue(v: any): any {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return v;
}
function csvEscape(v: any): string {
  const s = String(flattenValue(v) ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function rowsToCsv(rows: any[]): string {
  if (!rows.length) return "";
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r ?? {})) keys.add(k);
  const cols = [...keys];
  const lines: string[] = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((k) => csvEscape(r?.[k])).join(","));
  return lines.join("\n");
}

async function uploadCsv(supabase: any, jobId: string, name: string, rows: any[]) {
  const csv = rowsToCsv(rows) || "(no data)\n";
  const path = `${jobId}/${name}.csv`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([csv], { type: "text/csv" }), {
    upsert: true, contentType: "text/csv",
  });
  if (error) console.error(`[export] upload ${name} failed:`, error.message);
  return path;
}

async function fetchAll(supabase: any, table: string, applyFilter?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) { console.error(`[export] ${table}:`, error.message); break; }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function processJob(supabase: any, jobId: string) {
  const files: { name: string; path: string; rows: number }[] = [];
  const updateJob = (patch: any) =>
    supabase.from("export_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    await updateJob({ current_step: "Carregando leads canônicos…", progress: 5 });
    const leads = await fetchAll(supabase, "lia_attendances", (q) => q.is("merged_into", null));
    const leadIds = leads.map((l: any) => l.id);
    files.push({ name: "Leads", path: await uploadCsv(supabase, jobId, "Leads", leads), rows: leads.length });

    // Expand deals/proposals/items from leads (in-memory but limited scope)
    const deals: any[] = [], proposals: any[] = [], items: any[] = [];
    for (const lead of leads) {
      const hist = Array.isArray(lead.piperun_deals_history) ? lead.piperun_deals_history : [];
      for (const d of hist) {
        if (!d || typeof d !== "object") continue;
        deals.push({ lead_id: lead.id, email: lead.email, nome: lead.nome, ...d, proposals: undefined });
        for (const p of (Array.isArray(d.proposals) ? d.proposals : [])) {
          proposals.push({ lead_id: lead.id, deal_id: d.deal_id, ...p, items: undefined });
          for (const it of (Array.isArray(p.items) ? p.items : [])) {
            items.push({ lead_id: lead.id, deal_id: d.deal_id, proposal_id: p.id, ...it });
          }
        }
      }
    }
    files.push({ name: "Deals", path: await uploadCsv(supabase, jobId, "Deals", deals), rows: deals.length });
    files.push({ name: "Proposals", path: await uploadCsv(supabase, jobId, "Proposals", proposals), rows: proposals.length });
    files.push({ name: "Proposal_Items", path: await uploadCsv(supabase, jobId, "Proposal_Items", items), rows: items.length });
    await updateJob({ progress: 25, lead_count: leads.length, deal_count: deals.length, files });

    // Free large in-memory structures before next phase
    (leads as any).length = 0;
    (deals as any).length = 0; (proposals as any).length = 0; (items as any).length = 0;

    const related: { table: string; sheet: string }[] = [
      { table: "v_lead_timeline", sheet: "Timeline" },
      { table: "lead_state_events", sheet: "State_Events" },
      { table: "lead_page_views", sheet: "Page_Views" },
      { table: "lead_conversion_history", sheet: "Conversions" },
      { table: "lead_opportunities", sheet: "Opportunities" },
      { table: "lead_form_submissions", sheet: "Form_Submissions" },
      { table: "lead_cart_history", sheet: "Cart_History" },
      { table: "lead_product_history", sheet: "Product_History" },
      { table: "lead_course_progress", sheet: "Course_Progress" },
      { table: "lead_sdr_interactions", sheet: "SDR_Interactions" },
      { table: "lead_activity_log", sheet: "Activity_Log" },
      { table: "lead_enrichment_audit", sheet: "Enrichment_Audit" },
      { table: "v_lead_cognitive", sheet: "Cognitive_View" },
      { table: "v_lead_commercial", sheet: "Commercial_View" },
      { table: "v_lead_ecommerce", sheet: "Ecommerce_View" },
      { table: "v_lead_financeiro", sheet: "Financeiro_View" },
      { table: "v_lead_academy", sheet: "Academy_View" },
    ];

    let i = 0;
    for (const { table, sheet } of related) {
      i++;
      try {
        await updateJob({ current_step: `Exportando ${sheet}…`, progress: 25 + Math.floor((i / related.length) * 70) });
        const rows = await fetchAll(supabase, table);
        files.push({ name: sheet, path: await uploadCsv(supabase, jobId, sheet, rows), rows: rows.length });
        await updateJob({ files });
      } catch (e) {
        console.warn(`[export] ${table} skipped:`, (e as Error).message);
      }
    }

    await updateJob({ status: "completed", progress: 100, current_step: "Concluído", files });
    console.log(`[export] job ${jobId} completed (${files.length} files)`);
  } catch (err) {
    console.error(`[export] job ${jobId} failed:`, err);
    await updateJob({ status: "failed", error: String(err) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isAdminData } = await supabase.rpc("is_admin", { user_id: userData.user.id });
    if (!isAdminData) return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Check status of existing job
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");
    if (jobId) {
      const { data: job } = await supabase.from("export_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job) return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      // sign URLs for completed files
      let signed: any[] = [];
      if (job.status === "completed" && Array.isArray(job.files)) {
        signed = await Promise.all(
          job.files.map(async (f: any) => {
            const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 3600);
            return { ...f, url: data?.signedUrl };
          })
        );
      }
      return new Response(JSON.stringify({ ...job, signed }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new job
    const { data: job, error: jobErr } = await supabase.from("export_jobs").insert({
      user_id: userData.user.id, status: "processing", progress: 0, current_step: "Iniciando…",
    }).select().single();
    if (jobErr) throw jobErr;

    // @ts-ignore EdgeRuntime is available in Supabase edge runtime
    EdgeRuntime.waitUntil(processJob(supabase, job.id));

    return new Response(JSON.stringify({ job_id: job.id, status: "processing" }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[export-leads-full] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
