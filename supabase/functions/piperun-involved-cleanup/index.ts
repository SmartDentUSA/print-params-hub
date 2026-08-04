// Limpeza retroativa: remove "usuários envolvidos" que não são o responsável atual
// dos deals ABERTOS do Funil de Vendas (bug do vendedor anterior que permanecia
// no deal após reatribuição/reativação).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://api.pipe.run/v1";
const VENDAS_PIPELINES = [18784, 72938, 83896];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("PIPERUN_API_KEY")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* noop */ }
  const dryRun = body.dry_run === true;
  const limit = Math.min(Number(body.limit ?? 200), 400);
  const offset = Number(body.offset ?? 0);

  const { data: deals, error } = await supabase
    .from("deals")
    .select("piperun_deal_id")
    .in("pipeline_id", VENDAS_PIPELINES)
    .eq("status", "aberta")
    .order("piperun_deal_id")
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const ids = (deals ?? [])
    .map((d) => String(d.piperun_deal_id ?? ""))
    .filter((id) => /^[0-9]+$/.test(id));

  let scanned = 0;
  let dealsWithExtras = 0;
  let removedCount = 0;
  const failed: Array<{ deal: string; user: number }> = [];
  const samples: unknown[] = [];

  for (const id of ids) {
    scanned++;
    const res = await fetch(`${BASE}/deals/${id}/users?token=${token}`);
    if (!res.ok) continue;
    const json = await res.json().catch(() => null);
    const rows = (json?.data ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length < 2) continue;

    const extras = rows.filter((u) => Number((u.pivot as Record<string, unknown>)?.flags) !== 1);
    if (extras.length === 0) continue;
    dealsWithExtras++;

    if (samples.length < 20) {
      const owner = rows.find((u) => Number((u.pivot as Record<string, unknown>)?.flags) === 1);
      samples.push({ deal_id: id, owner: owner?.name ?? null, removed: extras.map((u) => u.name) });
    }

    if (dryRun) continue;
    for (const u of extras) {
      const uid = Number(u.id);
      const del = await fetch(`${BASE}/deals/${id}/users/${uid}?token=${token}`, { method: "DELETE" });
      if (del.ok) removedCount++;
      else failed.push({ deal: id, user: uid });
    }
  }

  return new Response(
    JSON.stringify({
      dry_run: dryRun,
      offset,
      limit,
      returned: ids.length,
      scanned,
      deals_with_extras: dealsWithExtras,
      involved_removed: removedCount,
      failed,
      samples,
      next_offset: ids.length > 0 ? offset + limit : null,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
