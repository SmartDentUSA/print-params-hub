// One-shot import runner for Loja Integrada staging.
// Accepts row batches via HTTP and writes to *_import tables using service_role.
// Preserves original event timestamps (created_at_source / order_created_at).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("LI_IMPORT_SHARED_SECRET")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.headers.get("x-import-secret") !== SHARED_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "recon-csv") {
      const { data, error } = await sb.rpc("execute_sql_read" as any, {}).select?.() ?? { data: null, error: null } as any;
      // Fallback: run recon directly via PostgREST since we don't have arbitrary SQL RPC.
      const csv = await buildReconCsv();
      return new Response(csv, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    const body = await req.json();
    const kind = body?.kind as "clientes" | "pedidos";
    const rows = body?.rows;
    if (!kind || !Array.isArray(rows) || rows.length === 0) {
      return json({ error: "invalid_payload" }, 400);
    }

    const table =
      kind === "clientes"
        ? "loja_integrada_clientes_import"
        : "loja_integrada_pedidos_items_import";

    let inserted = 0;
    const CHUNK = 200;
    const errors: unknown[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      let q = sb.from(table).upsert(slice, {
        onConflict: kind === "clientes" ? "id" : undefined,
        ignoreDuplicates: kind === "pedidos",
      });
      const { error, count } = await q;
      if (error) {
        errors.push({ i, message: error.message, details: (error as any).details });
        // fallback: try one-by-one to preserve as many as possible
        for (const r of slice) {
          const single = await sb.from(table).upsert(r, {
            onConflict: kind === "clientes" ? "id" : undefined,
            ignoreDuplicates: kind === "pedidos",
          });
          if (!single.error) inserted += 1;
          else errors.push({ row_key: (r as any).id ?? (r as any).pedido_numero, msg: single.error.message });
        }
      } else {
        inserted += count ?? slice.length;
      }
    }
    return json({ ok: true, kind, received: rows.length, inserted, errors: errors.slice(0, 20) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function buildReconCsv(): Promise<string> {
  // Pull all order items via service role (bypasses RLS)
  const items: any[] = [];
  let off = 0;
  while (true) {
    const { data, error } = await sb
      .from("loja_integrada_pedidos_items_import")
      .select("sku_produto,nome_produto,quantidade,pedido_numero,pedido_situacao,pedido_valor_total,order_created_at,cliente_id")
      .range(off, off + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < 1000) break;
    off += 1000;
  }
  const cat = (await sb.from("system_a_catalog").select("id,name,product_category").limit(5000)).data ?? [];
  const res = (await sb.from("resins").select("id,name").limit(5000)).data ?? [];
  const catBy = new Map<string, any>();
  for (const c of cat) catBy.set(String(c.name ?? "").trim().toLowerCase(), c);
  const resBy = new Map<string, any>();
  for (const r of res) resBy.set(String(r.name ?? "").trim().toLowerCase(), r);

  const OK = new Set(["Pedido Enviado", "Pedido Entregue", "Pedido Pago"]);
  const agg = new Map<string, any>();
  for (const it of items) {
    const sku = it.sku_produto ?? "(sem sku)";
    let a = agg.get(sku);
    if (!a) {
      a = { sku, nome: it.nome_produto, pedidos: new Set(), clientes: new Set(), qtd: 0, receita: 0, first: null, last: null };
      agg.set(sku, a);
    }
    if (OK.has(it.pedido_situacao)) {
      a.pedidos.add(it.pedido_numero);
      a.clientes.add(it.cliente_id);
      a.qtd += Number(it.quantidade || 0);
      a.receita += Number(it.pedido_valor_total || 0);
      const d = it.order_created_at;
      if (d) {
        if (!a.first || d < a.first) a.first = d;
        if (!a.last || d > a.last) a.last = d;
      }
    }
  }

  const rows: any[] = [];
  for (const a of agg.values()) {
    const key = String(a.nome ?? "").trim().toLowerCase();
    const cm = catBy.get(key);
    const rm = resBy.get(key);
    const pedidos_ok = a.pedidos.size;
    let acao = "CRIAR_NO_CATALOGO";
    if (cm) acao = "MATCH_CATALOGO";
    else if (rm) acao = "MATCH_RESIN";
    else if (pedidos_ok === 0) acao = "INATIVO";
    rows.push({
      sku_loja_integrada: a.sku,
      nome_produto_li: a.nome ?? "",
      acao,
      pedidos_validos: pedidos_ok,
      clientes_unicos: a.clientes.size,
      quantidade_total: Math.round(a.qtd * 100) / 100,
      receita_bruta_pedidos: Math.round(a.receita * 100) / 100,
      primeira_venda: (a.first || "").toString().slice(0, 10),
      ultima_venda: (a.last || "").toString().slice(0, 10),
      catalogo_nome: cm?.name ?? "",
      catalogo_categoria: cm?.product_category ?? "",
      resin_nome: rm?.name ?? "",
    });
  }
  rows.sort((a, b) => b.receita_bruta_pedidos - a.receita_bruta_pedidos);
  const cols = Object.keys(rows[0] ?? { x: "" });
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc((r as any)[c])).join(","));
  return lines.join("\n");
}