import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { makeGuidedExecutors, executePendingAction } from "./guided.ts";

const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
Deno.test({ name: "fluxo real: preparar → confirmar tabela; preparar → cancelar campanha", ignore: !url || !key, sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const sb = createClient(url!, key!);
  const ctx = { sb, userId: crypto.randomUUID(), supabaseUrl: url!, serviceKey: key! };
  const pend: any[] = [];
  const ex = makeGuidedExecutors(ctx, (p) => pend.push(p));
  const found = await ex.find_catalog_items({ search: "Vitality" });
  console.log("catalogo", found.total, JSON.stringify(found.itens?.[0]));
  const it = found.itens[0];
  const prep = await ex.prepare_promotional_table({ name: "TESTE COPILOT (apagar)", valid_from: "2026-11-20", valid_until: "2026-11-30",
    sections: [{ title: "Combo teste", items: [{ catalog_product_id: it.catalog_product_id, catalog_variation_id: it.catalog_variation_id, quantity: 2, promotional_unit_price: 100 }] }] });
  console.log("prep", JSON.stringify(prep).slice(0, 300));
  assert(prep.pending_action_id);
  console.log(pend[0].summary);
  const { count: before } = await sb.from("promotional_tables").select("id", { count: "exact", head: true }).eq("name", "TESTE COPILOT (apagar)");
  assertEquals(before, 0); // nada gravado antes de confirmar
  const ok = await executePendingAction(ctx, prep.pending_action_id, "confirm");
  console.log("confirm", ok.content);
  assert(ok.ok);
  const again = await executePendingAction(ctx, prep.pending_action_id, "confirm");
  assert(!again.ok); console.log("again", again.content);
  const other = await executePendingAction({ ...ctx, userId: crypto.randomUUID() }, prep.pending_action_id, "confirm");
  assert(!other.ok); console.log("outro usuario", other.content);
  const tid = (ok.result as any).table_id;
  const { data: t } = await sb.from("promotional_tables").select("status,name").eq("id", tid).single();
  const { data: items } = await sb.from("promotional_table_items").select("name,quantity,market_unit_price,promotional_unit_price,item_type, promotional_table_sections!inner(promotional_table_id)").eq("promotional_table_sections.promotional_table_id", tid);
  console.log("gravado", JSON.stringify(t), JSON.stringify(items));
  assertEquals(t?.status, "active");
  assertEquals(items?.length, 1);
  await sb.from("promotional_tables").delete().eq("id", tid);

  const groups = await ex.list_wa_groups({});
  const g = groups.grupos[0];
  const w = await ex.prepare_wa_group_campaign({ name: "TESTE COPILOT WA (cancelar)", group_ids: [g.id], steps: [{ type: "msg", text: "Teste" }, { type: "wait", hours: 1 }, { type: "link", title: "Site", url: "https://www.smartdent.com.br" }] });
  assert(w.pending_action_id); console.log(pend[1].summary);
  const c = await executePendingAction(ctx, w.pending_action_id, "cancel");
  assert(c.ok); console.log("cancel", c.content);
  const { count: wc } = await sb.from("wa_campaigns").select("id", { count: "exact", head: true }).eq("name", "TESTE COPILOT WA (cancelar)");
  assertEquals(wc, 0);
  await sb.from("copilot_pending_actions").delete().eq("user_id", ctx.userId);
}});
