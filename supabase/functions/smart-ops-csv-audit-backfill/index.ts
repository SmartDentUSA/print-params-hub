import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * One-shot: audita o CSV de export Piperun e, opcionalmente, faz backfill.
 *
 * Body:
 *   { csv: string, dry_run?: boolean, offset?: number, limit?: number,
 *     enrich?: boolean, create_deals?: boolean }
 *
 * - dry_run=true     → só relatório, nenhuma escrita.
 * - enrich=true      → preenche form_name/produto_interesse/source/data_primeiro_contato
 *                      via COALESCE (não sobrescreve valores existentes).
 * - create_deals=true → para canônicos sem Deal, invoca smart-ops-lia-assign com
 *                      commercial_override=true. Para ausentes da base, invoca
 *                      smart-ops-ingest-lead.
 *
 * Pagine com offset/limit (default offset=0 limit=400) — função tem CPU cap.
 */

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cols = parseLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || "").trim(); });
    return row;
  });
}

function normPhone(raw: string): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  while (d.startsWith("0")) d = d.slice(1);
  if (!d) return null;
  if (!d.startsWith("55")) d = "55" + d;
  if (d.length < 12 || d.length > 13) return null;
  return "+" + d;
}

function detectProduct(formName: string | null): string | null {
  if (!formName) return null;
  const u = formName.toUpperCase();
  if (u.includes("INO110") || u.includes("INO100")) return "BLZ INO100 PLUS + NOTEBOOK";
  if (u.includes("INO200") || u.includes("INO 200")) return "BLZ INO200";
  if (u.includes("GLAZEON")) return "GlazeON";
  if (u.includes("POSCURA") || u.includes("PÓSCURA")) return "ShapeCure V";
  if (/(^|[^A-Z])BLZ([\s-]|$)/i.test(formName)) return "BLZ INO200";
  if (u.includes("MEDIT")) return "Medit";
  if (u.includes("IMPRESORAS")) return "RayShape Edge mini";
  if (u.includes("SCANNER")) return "Scanner Intraoral";
  if (u.includes("IMPRESSORA") || u.includes("PRINTER")) return "Impressora 3D";
  return null;
}

function parseCsvDate(s: string): string | null {
  // "05/25/2026 8:46pm" → ISO
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let [_, mo, da, yr, hh, mm, ap] = m;
  let h = parseInt(hh);
  if (ap?.toLowerCase() === "pm" && h < 12) h += 12;
  if (ap?.toLowerCase() === "am" && h === 12) h = 0;
  // Treat as America/Sao_Paulo (UTC-3) → convert to UTC
  const isoLocal = `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}T${String(h).padStart(2, "0")}:${mm}:00-03:00`;
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function followCanonical(
  supabase: ReturnType<typeof createClient>,
  lead: any,
): Promise<any> {
  let cur = lead;
  for (let i = 0; i < 5 && cur?.merged_into; i++) {
    const { data: parent } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("id", cur.merged_into)
      .maybeSingle();
    if (!parent) break;
    cur = parent;
  }
  return cur;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const csvText: string = body.csv || "";
  const dryRun: boolean = body.dry_run !== false; // default: dry_run=true (safe)
  const enrich: boolean = body.enrich === true;
  const createDeals: boolean = body.create_deals === true;
  const offset: number = Math.max(0, Number(body.offset) || 0);
  const limit: number = Math.min(800, Math.max(1, Number(body.limit) || 400));

  if (!csvText) {
    return new Response(JSON.stringify({ error: "csv_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const allRows = parseCSV(csvText);
  // dedupe by (email||phone), keep first occurrence (most recent — CSV is desc)
  const seen = new Set<string>();
  const uniq: Array<Record<string, string>> = [];
  for (const r of allRows) {
    const e = (r["Email"] || "").trim().toLowerCase();
    const p = normPhone(r["Telefone"] || r["Número do WhatsApp"] || "");
    const key = e || p;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniq.push(r);
  }

  const slice = uniq.slice(offset, offset + limit);

  const results: any[] = [];
  const counts: Record<string, number> = {
    ok_com_deal: 0, pessoa_sem_deal: 0, ausente: 0, mergeado: 0, crm_blocked: 0,
    enriched: 0, deal_triggered: 0, ingested: 0, error: 0,
  };

  for (const row of slice) {
    const emailRaw = (row["Email"] || "").trim().toLowerCase();
    const phone = normPhone(row["Telefone"] || row["Número do WhatsApp"] || "");
    const nome = (row["Nome"] || "").trim();
    const formNameRaw = (row["Formulário"] || "").trim();
    const formName = formNameRaw.replace(/^#\s*/, "").trim();
    const produto = detectProduct(formName);
    const criadoIso = parseCsvDate(row["Criado em"] || "");

    const out: any = { email: emailRaw, phone, nome, form_name: formName, produto_derivado: produto, criado: row["Criado em"], status: null, lead_id: null, piperun_id: null, deals_count: 0, action: [] };

    try {
      // Lookup canonical lead
      let lead: any = null;
      if (emailRaw) {
        const { data } = await supabase.from("lia_attendances").select("*").eq("email", emailRaw).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) lead = data;
      }
      if (!lead && phone) {
        const { data } = await supabase.from("lia_attendances").select("*").eq("telefone_normalized", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) lead = data;
      }

      if (!lead) {
        out.status = "ausente";
        counts.ausente++;
        if (!dryRun && createDeals && (emailRaw || phone)) {
          // Ingerir via smart-ops-ingest-lead (não passa created_time como coluna — vai dentro do payload)
          const payload: any = {
            source: "meta_lead_ads",
            form_name: formName,
            campaign: formName,
            origem_campanha: formName,
            nome,
            email: emailRaw,
            phone_number: phone,
            produto_interesse: produto,
            commercial_override: true,
            raw_payload_meta: { import_source: "csv_audit_backfill", criado_em_piperun: row["Criado em"], created_at_iso: criadoIso },
          };
          const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
            body: JSON.stringify(payload),
          });
          out.action.push(`ingest:${res.status}`);
          if (res.ok) counts.ingested++;
        }
        results.push(out);
        continue;
      }

      const wasMerged = !!lead.merged_into;
      if (wasMerged) {
        lead = await followCanonical(supabase, lead);
        out.action.push(`merged→${lead.id}`);
      }

      out.lead_id = lead.id;
      out.piperun_id = lead.piperun_id;

      const { count: dealsCount } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("lead_id", lead.id).neq("is_deleted", true);
      out.deals_count = dealsCount || 0;

      if ((dealsCount || 0) > 0) {
        out.status = "ok_com_deal";
        counts.ok_com_deal++;
      } else if (lead.crm_creation_blocked) {
        out.status = "crm_blocked";
        out.crm_block_reason = lead.crm_creation_blocked_reason;
        counts.crm_blocked++;
      } else {
        out.status = "pessoa_sem_deal";
        counts.pessoa_sem_deal++;
      }
      if (wasMerged) counts.mergeado++;

      // Enrichment (COALESCE-style) — só para canônicos não bloqueados
      if (!dryRun && enrich && !lead.crm_creation_blocked) {
        const updateFields: Record<string, any> = {};
        if (!lead.form_name && formName) updateFields.form_name = formName;
        if (!lead.origem_campanha && formName) updateFields.origem_campanha = formName;
        if (!lead.source) updateFields.source = "meta_lead_ads";
        if (!lead.produto_interesse && produto) updateFields.produto_interesse = produto;
        if (!lead.produto_interesse_auto && produto) updateFields.produto_interesse_auto = produto;
        if (!lead.telefone_normalized && phone) updateFields.telefone_normalized = phone;
        if (criadoIso && (!lead.data_primeiro_contato || new Date(criadoIso) < new Date(lead.data_primeiro_contato))) {
          updateFields.data_primeiro_contato = criadoIso;
        }
        if (Object.keys(updateFields).length) {
          const { error: upErr } = await supabase.from("lia_attendances").update(updateFields).eq("id", lead.id);
          if (!upErr) { counts.enriched++; out.action.push(`enriched:${Object.keys(updateFields).join(",")}`); }
          else out.action.push(`enrich_err:${upErr.message}`);
        }
      }

      // Trigger Deal creation
      if (!dryRun && createDeals && out.status === "pessoa_sem_deal") {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ lead_id: lead.id, commercial_override: true, trigger: "csv_audit_backfill" }),
        });
        out.action.push(`assign:${res.status}`);
        if (res.ok) counts.deal_triggered++;
      }
    } catch (e) {
      counts.error++;
      out.status = "error";
      out.error = String(e);
    }
    results.push(out);
    // light pacing to respect Piperun rate limit
    if (!dryRun && createDeals) await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({
    total_unique: uniq.length,
    processed: slice.length,
    offset, limit,
    next_offset: offset + slice.length < uniq.length ? offset + slice.length : null,
    counts,
    results: results.slice(0, 1500),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});