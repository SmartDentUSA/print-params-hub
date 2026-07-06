// smart-ops-evogo-groups-webhook
// Recebe eventos do EvoGo (messages.upsert, groups.update, chats.upsert, etc.)
// e faz upsert em wa_groups sempre que aparece um JID @g.us — resolvendo a
// falta de endpoint de listagem de grupos na API do EvoGo.
//
// Configuração: apontar o webhook do instance EvoGo para
//   https://<supabase>/functions/v1/smart-ops-evogo-groups-webhook?instance=<evolution_instance_name>
// (o param `instance` é o nome canônico usado em team_members.evolution_instance_name)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function collectGroupHints(node: any, acc: Map<string, { name?: string; picture?: string }>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) collectGroupHints(n, acc); return; }

  // Detect JIDs
  const candidateJidFields = ["remoteJid", "groupJid", "id", "jid", "chatId"];
  for (const f of candidateJidFields) {
    const v = node[f];
    if (typeof v === "string" && v.endsWith("@g.us")) {
      if (!acc.has(v)) acc.set(v, {});
      const cur = acc.get(v)!;
      // Nome possível em irmãos
      const name = node.subject ?? node.groupName ?? node.name ?? node.pushName;
      if (typeof name === "string" && name.trim() && !cur.name) cur.name = name.trim().slice(0, 200);
      const pic = node.profilePicUrl ?? node.pictureUrl ?? node.picture_url;
      if (typeof pic === "string" && pic.startsWith("http") && !cur.picture) cur.picture = pic;
    }
  }
  for (const k of Object.keys(node)) collectGroupHints(node[k], acc);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    let instance = url.searchParams.get("instance") ?? "";
    const raw = await req.text();
    let body: any = null;
    try { body = JSON.parse(raw); } catch { /* pode ser vazio/ping */ }

    // Fallbacks p/ descobrir instance_name a partir do payload
    if (!instance && body) {
      instance =
        body.instance ??
        body.instanceName ??
        body.instance_name ??
        body?.data?.instance ??
        "";
    }

    console.log(`[evogo-groups-webhook] instance=${instance || "?"} bytes=${raw.length} event=${body?.event ?? "-"}`);

    if (!instance) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hints = new Map<string, { name?: string; picture?: string }>();
    collectGroupHints(body, hints);

    if (hints.size === 0) {
      return new Response(JSON.stringify({ ok: true, groups: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let upserted = 0;
    for (const [jid, info] of hints) {
      // Não sobrescrevemos is_admin nem name existente (upsert com ignoreDuplicates=false + merge parcial)
      const { data: existing } = await supabase
        .from("wa_groups")
        .select("id, name, picture_url")
        .eq("group_jid", jid)
        .eq("instance_name", instance)
        .maybeSingle();

      if (existing) {
        const patch: Record<string, unknown> = { synced_at: now, updated_at: now };
        if (info.name && !existing.name) patch.name = info.name;
        if (info.picture && !existing.picture_url) patch.picture_url = info.picture;
        await supabase.from("wa_groups").update(patch).eq("id", existing.id);
      } else {
        await supabase.from("wa_groups").insert({
          group_jid: jid,
          instance_name: instance,
          name: info.name ?? null,
          picture_url: info.picture ?? null,
          is_admin: true,
          ativo: true,
          enabled: true,
          synced_at: now,
        });
      }
      upserted++;
    }

    console.log(`[evogo-groups-webhook] instance=${instance} upserted=${upserted}`);
    return new Response(JSON.stringify({ ok: true, instance, groups: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[evogo-groups-webhook] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});