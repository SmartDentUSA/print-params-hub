// Cadastra no CRM (caminho oficial smart-ops-ingest-lead, Regra de Ouro, sorteio
// normal de vendedor) os leads da Loja Integrada com carrinho abandonado (2 h sem
// pagamento) ou pedido cancelado. Cada pedido conta uma vez por tipo.
// Modos: { mode: "cancel", lead_id, order } (chamado pelo webhook) | { mode: "scan" } (reconciler).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ABANDON_AFTER_MS, buildResponses, CatalogRow, LOJA_ORIGINS, LojaKind, OrderInfo, pickInterest, submissionKey,
} from "./logic.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(URL_, SRK);

let catalogCache: CatalogRow[] | null = null;
async function catalog(): Promise<CatalogRow[]> {
  if (catalogCache) return catalogCache;
  const { data } = await sb.from("system_a_catalog").select("name, product_category, product_subcategory")
    .eq("active", true).not("name", "is", null).limit(2000);
  catalogCache = (data ?? []) as CatalogRow[];
  return catalogCache;
}

async function ensureForm(origin: string): Promise<string> {
  const { data } = await sb.from("smartops_forms").select("id").eq("name", origin).maybeSingle();
  if (data?.id) return data.id;
  const slug = origin.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: c, error } = await sb.from("smartops_forms")
    .insert({ name: origin, slug, title: origin, form_purpose: "sdr_captacao", active: false }).select("id").single();
  if (error) throw new Error(`form: ${error.message}`);
  return c.id;
}

async function process(kind: LojaKind, leadId: string, o: OrderInfo) {
  const key = submissionKey(kind, o.pedido);
  const { data: done } = await sb.from("lead_activity_log").select("id")
    .eq("event_type", "loja_crm_insercao").eq("entity_id", key).limit(1);
  if (done?.length) return { skipped: "ja_processado", key };

  const { data: lead } = await sb.from("lia_attendances")
    .select("id, nome, email, telefone_normalized, merged_into").eq("id", leadId).maybeSingle();
  if (!lead) return { skipped: "lead_nao_encontrado", key };
  let L = lead;
  if (lead.merged_into) {
    const { data: c } = await sb.from("lia_attendances").select("id, nome, email, telefone_normalized, merged_into")
      .eq("id", lead.merged_into).is("merged_into", null).maybeSingle();
    if (c) L = c;
  }
  if (!L.email && !L.telefone_normalized) return { skipped: "sem_email_telefone", key };

  const cat = await catalog();
  const { produto, categorias } = pickInterest(o.itens, cat);
  const origin = LOJA_ORIGINS[kind];
  const formId = await ensureForm(origin);
  const responses = buildResponses(kind, o, produto, categorias, cat);
  const payload = {
    source: "form", form_name: origin, form_id: formId, form_purpose: "sdr_captacao",
    nome: L.nome, ...(L.email ? { email: L.email } : {}), ...(L.telefone_normalized ? { telefone_raw: L.telefone_normalized } : {}),
    ...(produto ? { produto_interesse: produto } : {}),
    utm_source: "loja_integrada", utm_medium: kind === "carrinho" ? "carrinho_abandonado" : "pedido_cancelado", utm_campaign: origin,
    form_responses: responses, submission_id: key,
  };
  const r = await fetch(`${URL_}/functions/v1/smart-ops-ingest-lead`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out?.lead_id) {
    console.error(`[loja-crm-lead] ingest falhou [${r.status}]`, JSON.stringify(out).slice(0, 500));
    return { error: "ingest", status: r.status, out, key };
  }
  await sb.from("lead_activity_log").insert({
    lead_id: out.lead_id, event_type: "loja_crm_insercao", source_channel: "loja_integrada",
    entity_type: "order", entity_id: key, entity_name: origin,
    event_data: { origem: origin, pedido: o.pedido, produto_interesse: produto, categorias, itens: o.itens, valor: o.valor ?? null },
    value_numeric: o.valor ?? null, event_timestamp: o.data || new Date().toISOString(),
  });
  // Dados do pedido na nota do negócio (mesmo caminho dos formulários)
  await fetch(`${URL_}/functions/v1/smart-ops-deal-form-note`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ lead_id: out.lead_id, form_name: origin, responses }),
  }).catch((e) => console.warn("[loja-crm-lead] nota", e));
  return { ok: true, key, lead_id: out.lead_id, produto, categorias };
}

async function orderDetails(leadId: string, pedido: string) {
  const { data } = await sb.from("lead_activity_log").select("event_data, event_timestamp")
    .eq("lead_id", leadId).eq("entity_id", pedido).like("event_type", "ecommerce_%")
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

async function scan() {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS).toISOString();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: carts } = await sb.from("lead_cart_history").select("id, lead_id, cart_id, items, created_at, status")
    .eq("status", "active").lte("created_at", cutoff).gte("created_at", since).limit(50);
  const results = [];
  for (const c of carts ?? []) {
    const { data: cancelled } = await sb.from("lead_activity_log").select("id").eq("entity_id", c.cart_id)
      .in("event_type", ["ecommerce_order_cancelled", "ecommerce_order_paid", "ecommerce_order_invoiced", "ecommerce_order_delivered"]).limit(1);
    if (cancelled?.length) continue; // pago ou cancelado: não é carrinho abandonado
    const det = await orderDetails(c.lead_id, c.cart_id);
    const ed = (det?.event_data ?? {}) as Record<string, any>;
    const itens = (Array.isArray(ed.itens) && ed.itens.length ? ed.itens : (c.items ?? []).map((i: any) => ({ nome: i.name, qty: i.qty, preco: i.price })))
      .map((i: any) => ({ nome: String(i.nome ?? i.name), qty: Number(i.qty ?? 1), preco: Number(i.preco ?? i.price ?? 0) }));
    const res = await process("carrinho", c.lead_id, {
      pedido: c.cart_id, data: det?.event_timestamp ?? c.created_at, status: "Não pago após 2 h", itens,
      valor: ed.valor ?? null, valor_envio: ed.valor_envio ?? null, forma_pagamento: ed.forma_pagamento ?? null,
      forma_envio: ed.forma_envio ?? null, cupom: ed.cupom?.codigo ?? null,
    });
    if ((res as any).ok || (res as any).skipped) {
      await sb.from("lead_cart_history").update({ status: "abandoned", abandoned_at: new Date().toISOString(), abandoned_reason: "nao_pago_2h" }).eq("id", c.id);
    }
    results.push(res);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("Authorization") !== `Bearer ${SRK}`) return json({ error: "unauthorized" }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.mode === "scan") return json({ ok: true, results: await scan() });
    if (body.mode === "cancel" && typeof body.lead_id === "string" && body.order?.pedido) {
      const o = body.order as OrderInfo;
      o.pedido = String(o.pedido);
      o.itens = (Array.isArray(o.itens) ? o.itens : []).map((i: any) => ({ nome: String(i.nome ?? "Produto"), qty: Number(i.qty ?? 1), preco: Number(i.preco ?? 0) }));
      return json(await process("cancelado", body.lead_id, o));
    }
    return json({ error: "payload inválido" }, 400);
  } catch (e) {
    console.error("[loja-crm-lead]", e);
    return json({ error: String(e) }, 500);
  }
});
