// One-off probe: descobre como o PipeRun expõe/remove "usuários envolvidos" (involved_users) de um deal.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://api.pipe.run/v1";

async function call(token: string, method: string, path: string, body?: unknown) {
  const url = `${BASE}/${path.replace(/^\/+/, "")}${path.includes("?") ? "&" : "?"}token=${token}`;
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown = text;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { method, path, status: res.status, ok: res.ok, data: json };
  } catch (e) {
    return { method, path, status: 0, ok: false, data: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("PIPERUN_API_KEY");
  if (!token) return new Response(JSON.stringify({ error: "missing PIPERUN_API_KEY" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* GET */ }
  const dealId = String(body.deal_id ?? url.searchParams.get("deal_id") ?? "");
  const mode = String(body.mode ?? url.searchParams.get("mode") ?? "inspect");
  const userId = Number(body.user_id ?? url.searchParams.get("user_id") ?? 0);
  if (!dealId) return new Response(JSON.stringify({ error: "deal_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const out: unknown[] = [];

  if (mode === "inspect") {
    out.push(await call(token, "GET", `deals/${dealId}`));
    out.push(await call(token, "GET", `deals/${dealId}/involvedUsers`));
    out.push(await call(token, "GET", `deals/${dealId}/involved_users`));
    out.push(await call(token, "GET", `dealInvolvedUsers?deal_id=${dealId}`));
    out.push(await call(token, "GET", `deals/involvedUsers?deal_id=${dealId}`));
    out.push(await call(token, "GET", `involvedUsers?deal_id=${dealId}`));
    out.push(await call(token, "GET", `deals/${dealId}/users`));
  } else if (mode === "users") {
    const r = await call(token, "GET", `deals/${dealId}/users`);
    const arr = ((r.data as any)?.data ?? []) as any[];
    out.push({ path: r.path, status: r.status, users: arr.map((u) => ({ id: u.id, name: u.name, pivot: u.pivot })) });
  } else if (mode === "cleanup_deals") {
    // Limpeza em lote: para cada deal informado, remove envolvidos que não são o dono.
    const ids = ((body.deal_ids as (string | number)[]) ?? []).map(String);
    const dryRun = body.dry_run !== false;
    for (const id of ids) {
      const r = await call(token, "GET", `deals/${id}/users`);
      const arr = ((r.data as any)?.data ?? []) as any[];
      const owner = arr.find((u) => Number(u?.pivot?.flags) === 1);
      const extras = arr.filter((u) => Number(u?.pivot?.flags) !== 1);
      const removed: number[] = [];
      if (!dryRun) {
        for (const u of extras) {
          const d = await call(token, "DELETE", `deals/${id}/users/${u.id}`);
          if (d.ok) removed.push(Number(u.id));
        }
      }
      out.push({
        deal_id: id,
        owner: owner ? { id: owner.id, name: owner.name } : null,
        extras: extras.map((u) => ({ id: u.id, name: u.name, role: u?.pivot?.role })),
        removed,
        dry_run: dryRun,
      });
    }
  } else if (mode === "sweep" && userId) {
    const paths = [
      ["DELETE", `deals/${dealId}/users/${userId}`],
      ["DELETE", `deals/${dealId}/user/${userId}`],
      ["DELETE", `dealsUsers/${userId}?deal_id=${dealId}`],
      ["DELETE", `deals/${dealId}/involvedUser/${userId}`],
      ["DELETE", `involved-users/${userId}?deal_id=${dealId}`],
      ["GET", `deals/${dealId}?with[]=involvedUsers`],
    ] as const;
    for (const [m, p2] of paths) out.push(await call(token, m, p2));
    const r = await call(token, "GET", `deals/${dealId}/users`);
    const arr = ((r.data as any)?.data ?? []) as any[];
    out.push({ path: "after", users: arr.map((u) => ({ id: u.id, name: u.name, pivot: u.pivot })) });
  } else if (mode === "put_users") {
    const field = String(body.field ?? "users");
    const ids = (body.user_ids as number[]) ?? [];
    out.push(await call(token, "PUT", `deals/${dealId}`, { [field]: ids }));
    const r = await call(token, "GET", `deals/${dealId}/users`);
    const arr = ((r.data as any)?.data ?? []) as any[];
    out.push({ path: "after", field, users: arr.map((u) => ({ id: u.id, name: u.name, pivot: u.pivot })) });
  } else if (mode === "try_add" && userId) {
    out.push(await call(token, "POST", `deals/${dealId}/users`, { user_id: userId }));
    out.push(await call(token, "POST", `deals/${dealId}/users`, { users: [userId] }));
    out.push(await call(token, "POST", `dealUsers`, { deal_id: Number(dealId), user_id: userId }));
    out.push(await call(token, "POST", `deals/${dealId}/involved`, { user_id: userId }));
  } else if (mode === "try_remove" && userId) {
    out.push(await call(token, "DELETE", `deals/${dealId}/users/${userId}`));
    out.push(await call(token, "DELETE", `deals/${dealId}/users?user_id=${userId}`));
    out.push(await call(token, "PUT", `deals/${dealId}`, { users: [] }));
    const r = await call(token, "GET", `deals/${dealId}/users`);
    const arr = ((r.data as any)?.data ?? []) as any[];
    out.push({ path: "after", users: arr.map((u) => ({ id: u.id, name: u.name, pivot: u.pivot })) });
  } else if (mode === "put_list" && userId) {
    out.push(await call(token, "PUT", `deals/${dealId}`, { involved_users: [userId] }));
    out.push(await call(token, "GET", `deals/${dealId}`));
  } else if (mode === "delete" && userId) {
    out.push(await call(token, "DELETE", `deals/${dealId}/involvedUsers/${userId}`));
    out.push(await call(token, "DELETE", `deals/${dealId}/involved_users/${userId}`));
    out.push(await call(token, "DELETE", `dealInvolvedUsers/${userId}?deal_id=${dealId}`));
    out.push(await call(token, "GET", `deals/${dealId}`));
  }

  return new Response(JSON.stringify({ deal_id: dealId, mode, results: out }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
