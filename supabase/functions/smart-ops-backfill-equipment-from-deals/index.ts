import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Backfill equip_* fields on lia_attendances using piperun deal_items as the
 * source of truth. Resins, kits, courses, accessories are ignored.
 *
 * Body: { limit?: number, offset?: number, dry_run?: boolean }
 * Defaults: limit=200, offset=0, dry_run=false
 */

type Cat = "scanner" | "scanner_bancada" | "impressora" | "pos_impressao" | "cad" | "notebook" | "fresadora";

interface Detection { cat: Cat; canonical: string; raw: string; }

// Acessórios/peças que NÃO são equipamentos, mesmo se contiverem nome de equipamento.
const ACCESSORY_RE = /\b(painel\s+lcd|tela\s+lcd|teflon|fep|nfep|pelicula|película|filme|filtro|fonte|placa\s+m[ãa]e|cabo|adesivo|parafuso|kit\s+(?:de\s+)?(?:reposi[çc][ãa]o|manuten[çc][ãa]o|limpeza)|reposi[çc][ãa]o|manuten[çc][ãa]o|spare|spare\s*part|cartucho|bandeja|plataforma\s+de?\s+constru[çc][ãa]o|build\s*plate|vat|cuba|elastico|elástico|bombinha|seringa|ponta|broca|garantia|extensao|extensão|treinamento|curso|aula|consultoria|servi[çc]o|frete|instala[çc][ãa]o)\b/i;

const RULES: Array<{ cat: Cat; re: RegExp; canon?: (m: string) => string }> = [
  // Scanner intraoral — exige modelo específico (não aceita "scanner intraoral" genérico)
  { cat: "scanner", re: /\b(medit\s*i[567]00|i600|i700|aoralscan\s*\d?|trios\s*\d|itero|primescan|panda\s*p\d|launca\s*\w*|runyes|shining\s*\w*|emerald)\b/i,
    canon: (m) => m.replace(/\s+/g, " ").trim() },
  // Scanner de bancada
  { cat: "scanner_bancada", re: /\b(scanner\s+de?\s*bancada|e\d\s*scanner|3shape\s*e\d|t710|aoralscan\s*lab)\b/i },
  // Impressora 3D — modelos específicos, sem aceitar "anycubic" ou "elegoo" sozinhos
  { cat: "impressora", re: /\b(halot\s*(?:one|mage|max|sky|ray)[\w\s\-]*|elegoo\s+(?:mars|saturn|jupiter)\s*\d?\s*(?:ultra|pro|plus|s|m|max)?|mars\s*\d\s*(?:ultra|pro)?|saturn\s*\d\s*(?:ultra|pro|s)?|phrozen\s+(?:sonic|mighty|shuffle)[\w\s\-]*|sonic\s+(?:mini|mighty|xl)[\w\s\-]*|anycubic\s+(?:photon|mono)[\w\s\-]*|miicraft[\w\s\-]*|rayshape\s+(?:edge|shape)[\w\s\-]*|edge\s*mini|edgemini|nextdent\s*\w*|asiga\s+\w+|formlabs\s+form\s*\d)\b/i },
  // Pós-impressão (cura/wash)
  { cat: "pos_impressao", re: /\b(wash[\s\-&]*cure|mercury\s*(?:plus|x|wash)\s*[\w.]*|nanoclean\s*pod|cure\s*m\d|uw\s*0?\d|smart\s*cure|formcure)\b/i },
  // CAD/CAM software
  { cat: "cad", re: /\b(exocad|exoplan|dentalcad|meshmixer|3shape\s*design|inlab|chairside\s*cad|blueskybio)\b/i },
  // Notebook / workstation
  { cat: "notebook", re: /\b(notebook|avell|workstation\s+\w+)\b/i },
  // Fresadora
  { cat: "fresadora", re: /\b(fresadora|cori\s?tec|vhf|roland\s*drm|imes|amann)\b/i },
];

function classify(name: string): Detection | null {
  const n = name.toLowerCase();
  if (ACCESSORY_RE.test(n)) return null;
  for (const r of RULES) {
    const m = n.match(r.re);
    if (m) return { cat: r.cat, canonical: r.canon ? r.canon(m[0]) : name.trim(), raw: name };
  }
  return null;
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  return /^n[ãa]o\b/i.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { limit?: number; offset?: number; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 500);
  const offset = Math.max(Number(body.offset ?? 0), 0);
  const dryRun = !!body.dry_run;

  // Distinct lead_ids that have piperun deal items, paginated.
  const { data: leadIdsRows, error: idsErr } = await supabase
    .from("deal_items")
    .select("lead_id")
    .eq("source", "piperun")
    .order("lead_id")
    .range(offset, offset + limit * 4); // overscan; we'll dedupe

  if (idsErr) {
    return new Response(JSON.stringify({ error: idsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const uniqueIds = [...new Set((leadIdsRows ?? []).map((r: any) => r.lead_id))].slice(0, limit);
  if (uniqueIds.length === 0) {
    return new Response(JSON.stringify({ scanned: 0, changed: 0, has_more: false, next_offset: offset }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Fetch existing equip fields
  const { data: leads, error: leadsErr } = await supabase
    .from("lia_attendances")
    .select("id,equip_scanner,equip_scanner_bancada,equip_impressora,impressora_modelo,equip_pos_impressao,equip_cad,software_cad,equip_notebook,equip_fresadora,tem_scanner,tem_impressora,status_scanner,status_impressora,status_cad")
    .in("id", uniqueIds)
    .is("merged_into", null);

  if (leadsErr) {
    return new Response(JSON.stringify({ error: leadsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadMap = new Map<string, any>((leads ?? []).map((l: any) => [l.id, l]));

  // Fetch all piperun items for these leads
  const { data: items, error: itemsErr } = await supabase
    .from("deal_items")
    .select("lead_id,product_name,synced_at")
    .eq("source", "piperun")
    .in("lead_id", uniqueIds);

  if (itemsErr) {
    return new Response(JSON.stringify({ error: itemsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group items by lead, pick best detection per category (most recent)
  const perLead = new Map<string, Map<Cat, { canonical: string; date: string | null }>>();
  for (const it of (items ?? []) as any[]) {
    if (!it.product_name) continue;
    const det = classify(it.product_name);
    if (!det) continue;
    let m = perLead.get(it.lead_id);
    if (!m) { m = new Map(); perLead.set(it.lead_id, m); }
    const prev = m.get(det.cat);
    if (!prev || (it.synced_at && (!prev.date || it.synced_at > prev.date))) {
      m.set(det.cat, { canonical: det.canonical, date: it.synced_at ?? null });
    }
  }

  let scanned = 0, changed = 0, skipped = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const leadId of uniqueIds) {
    scanned++;
    const lead = leadMap.get(leadId);
    if (!lead) { skipped++; continue; }
    const detections = perLead.get(leadId);
    if (!detections || detections.size === 0) { skipped++; continue; }

    const update: Record<string, unknown> = {};

    for (const [cat, info] of detections) {
      switch (cat) {
        case "scanner":
          if (isEmpty(lead.equip_scanner)) update.equip_scanner = info.canonical;
          if (isEmpty(lead.tem_scanner)) update.tem_scanner = "sim";
          if (isEmpty(lead.status_scanner)) update.status_scanner = "tem_smartdent";
          break;
        case "scanner_bancada":
          if (isEmpty(lead.equip_scanner_bancada)) update.equip_scanner_bancada = info.canonical;
          break;
        case "impressora":
          if (isEmpty(lead.equip_impressora)) update.equip_impressora = info.canonical;
          if (isEmpty(lead.impressora_modelo)) update.impressora_modelo = info.canonical;
          if (isEmpty(lead.tem_impressora)) update.tem_impressora = "sim";
          if (isEmpty(lead.status_impressora)) update.status_impressora = "tem_smartdent";
          break;
        case "pos_impressao":
          if (isEmpty(lead.equip_pos_impressao)) update.equip_pos_impressao = info.canonical;
          break;
        case "cad":
          if (isEmpty(lead.equip_cad)) update.equip_cad = info.canonical;
          if (isEmpty(lead.software_cad)) update.software_cad = info.canonical;
          if (/exocad/i.test(info.canonical) && isEmpty(lead.status_cad)) update.status_cad = "tem_exocad";
          break;
        case "notebook":
          if (isEmpty(lead.equip_notebook)) update.equip_notebook = info.canonical;
          break;
        case "fresadora":
          if (isEmpty(lead.equip_fresadora)) update.equip_fresadora = info.canonical;
          break;
      }
    }

    if (Object.keys(update).length === 0) { skipped++; continue; }

    if (samples.length < 8) samples.push({ lead_id: leadId, update });

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("lia_attendances")
        .update(update)
        .eq("id", leadId);
      if (upErr) { console.error("[backfill-equip]", leadId, upErr.message); continue; }
      await supabase.from("lead_enrichment_audit").insert({
        lead_id: leadId,
        source: "backfill_equipment_from_deals",
        source_priority: 3,
        fields_updated: Object.keys(update),
        new_values: update,
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
    changed++;
  }

  return new Response(JSON.stringify({
    scanned, changed, skipped,
    next_offset: offset + (leadIdsRows?.length ?? 0),
    has_more: (leadIdsRows?.length ?? 0) >= limit * 4,
    dry_run: dryRun,
    samples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});