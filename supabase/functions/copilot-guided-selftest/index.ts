// TEMPORÁRIO — autoteste do fluxo guiado; removido após a verificação.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { makeGuidedExecutors, executePendingAction } from "../smart-ops-copilot/guided.ts";
const H = "c41054dc6db9b1134d07f7dca45a4726c51719d1241d88d14d85747c68194107";
async function sha(t: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, "0")).join(""); }
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if ((await sha(String(body.token || ""))) !== H) return new Response("no", { status: 403 });
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  const log: any[] = [];
  const ctx = { sb, userId: crypto.randomUUID(), supabaseUrl: url, serviceKey: key };
  const pend: any[] = [];
  const ex = makeGuidedExecutors(ctx, (p) => pend.push(p));
  try {
    const found = await ex.find_catalog_items({ search: "Vitality" });
    log.push({ catalogo: found.total, primeiro: found.itens?.[0] });
    const it = found.itens[0];
    const bad = await ex.prepare_promotional_table({ name: "X", valid_from: "2026-11-20", valid_until: "2026-11-30", sections: [{ title: "C", items: [{ catalog_product_id: it.catalog_product_id }] }] });
    log.push({ sem_preco: bad });
    const prep = await ex.prepare_promotional_table({ name: "TESTE COPILOT (apagar)", valid_from: "2026-11-20", valid_until: "2026-11-30",
      sections: [{ title: "Combo teste", items: [{ catalog_product_id: it.catalog_product_id, catalog_variation_id: it.catalog_variation_id, quantity: 2, promotional_unit_price: 100 }] }] });
    log.push({ prep, resumo: pend[0]?.summary });
    const { count: antes } = await sb.from("promotional_tables").select("id", { count: "exact", head: true }).eq("name", "TESTE COPILOT (apagar)");
    log.push({ gravado_antes_de_confirmar: antes });
    const other = await executePendingAction({ ...ctx, userId: crypto.randomUUID() }, prep.pending_action_id, "confirm");
    log.push({ outro_usuario: other });
    const ok = await executePendingAction(ctx, prep.pending_action_id, "confirm");
    log.push({ confirm: ok });
    const again = await executePendingAction(ctx, prep.pending_action_id, "confirm");
    log.push({ duplo_clique: again });
    const tid = (ok.result as any)?.table_id;
    if (tid) {
      const { data: t } = await sb.from("promotional_tables").select("status,name,created_by,currency,valid_from,valid_until").eq("id", tid).single();
      const { data: secs } = await sb.from("promotional_table_sections").select("id,title").eq("promotional_table_id", tid);
      const { data: items } = await sb.from("promotional_table_items").select("name,sku,quantity,market_unit_price,promotional_unit_price,item_type,image_url").in("section_id", (secs || []).map((s: any) => s.id));
      log.push({ tabela: t, combos: secs, itens: items });
      await sb.from("promotional_tables").delete().eq("id", tid);
    }
    const groups = await ex.list_wa_groups({});
    const g = groups.grupos?.[0];
    const w = await ex.prepare_wa_group_campaign({ name: "TESTE COPILOT WA (cancelar)", group_ids: [g.id], steps: [{ type: "msg", text: "Teste" }, { type: "wait", hours: 1 }, { type: "link", title: "Site", url: "https://www.smartdent.com.br" }] });
    log.push({ wa_prep: w, wa_resumo: pend[1]?.summary });
    const c = await executePendingAction(ctx, w.pending_action_id, "cancel");
    log.push({ wa_cancel: c });
    const { count: wc } = await sb.from("wa_campaigns").select("id", { count: "exact", head: true }).eq("name", "TESTE COPILOT WA (cancelar)");
    log.push({ campanhas_gravadas: wc });
  } catch (e) { log.push({ erro: String(e) }); }
  await sb.from("copilot_pending_actions").delete().eq("user_id", ctx.userId);
  return Response.json(log);
});
