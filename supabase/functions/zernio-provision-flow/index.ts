import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_ID = "6a1e1a2368fd70c014724ef0";
const ACCOUNT_ID = "6a1e1b992b2567671a925559";
const ZERNIO_BASE = "https://zernio.com/api/v1/comment-automations";

// A Zernio envia o texto literal: nenhum {{placeholder}} é interpolado.
function stripPlaceholders(s: string): string {
  return String(s ?? "").replace(/\{\{\s*[\w.]+\s*\}\}/g, "").replace(/\s{2,}/g, " ").replace(/ ,/g, ",").trim();
}

function buildPayload(flow: any) {
  const c: any = flow.zernio_automation_config ?? {};
  const variations = (c.dm_message_variations ?? []).map(stripPlaceholders).filter(Boolean).slice(0, 5);
  const replyVariations = (c.comment_reply_variations ?? []).map(stripPlaceholders).filter(Boolean).slice(0, 5);
  return {
    profileId: PROFILE_ID,
    accountId: ACCOUNT_ID,
    name: flow.name,
    keywords: c.keywords ?? [],
    matchMode: "contains",
    dmMessage: stripPlaceholders(c.dm_message ?? ""),
    dmMessageVariations: variations,
    commentReply: stripPlaceholders(c.comment_reply ?? ""),
    commentReplyVariations: replyVariations,
    linkTracking: false,
  };
}

async function zernioCall(key: string, url: string, method: string, payload: any) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  let d: any = {};
  try { d = JSON.parse(t); } catch { d = { raw: t }; }
  return { ok: r.ok, status: r.status, data: d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const { flow_id } = body;
    const resync: boolean = body?.resync === true; // também atualiza automações já criadas
    const batch: boolean = body?.batch === true || (!flow_id);
    const limit: number = Number(body?.limit ?? 60);

    const zernioKey = Deno.env.get("ZERNIO_API_KEY");
    if (!zernioKey) throw new Error("ZERNIO_API_KEY not configured");

    // ---- modo lote: cria (ou atualiza, com resync) os flows IG ativos
    if (batch) {
      let q = supabase
        .from("social_flows")
        .select("id, name, zernio_automation_id, zernio_automation_config")
        .eq("channel", "instagram")
        .eq("is_active", true)
        .limit(limit);
      if (!resync) q = q.is("zernio_automation_id", null);

      const { data: pending, error: pErr } = await q;
      if (pErr) throw pErr;

      const results: any[] = [];
      for (const f of pending ?? []) {
        const payload = buildPayload(f);
        if (!Array.isArray(payload.keywords) || payload.keywords.length === 0) {
          results.push({ flow_id: f.id, name: f.name, ok: false, error: "sem_keywords" });
          continue;
        }
        try {
          const existingId = (f as any).zernio_automation_id;
          const res = existingId
            ? await zernioCall(zernioKey, `${ZERNIO_BASE}/${existingId}`, "PATCH", payload)
            : await zernioCall(zernioKey, ZERNIO_BASE, "POST", payload);
          const id = res.data?.automation?.id ?? res.data?.id ?? existingId ?? null;
          if (!res.ok || !id) {
            results.push({ flow_id: f.id, name: f.name, ok: false, status: res.status, response: res.data });
            continue;
          }
          await supabase.from("social_flows")
            .update({ zernio_automation_id: id, updated_at: new Date().toISOString() })
            .eq("id", f.id);
          results.push({ flow_id: f.id, name: f.name, ok: true, updated: !!existingId, zernio_automation_id: id, keywords: payload.keywords });
        } catch (e) {
          results.push({ flow_id: f.id, name: f.name, ok: false, error: String((e as Error)?.message ?? e) });
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        mode: resync ? "batch_resync" : "batch",
        pending: pending?.length ?? 0,
        provisioned: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: flow, error } = await supabase
      .from("social_flows")
      .select("id, name, zernio_automation_id, zernio_automation_config")
      .eq("id", flow_id)
      .single();
    if (error) throw error;

    const payload = buildPayload(flow);

    if (flow.zernio_automation_id && !resync) {
      return new Response(
        JSON.stringify({ ok: true, already: true, zernio_automation_id: flow.zernio_automation_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = flow.zernio_automation_id
      ? await zernioCall(zernioKey, `${ZERNIO_BASE}/${flow.zernio_automation_id}`, "PATCH", payload)
      : await zernioCall(zernioKey, ZERNIO_BASE, "POST", payload);
    const zernioId = res.data?.automation?.id ?? res.data?.id ?? flow.zernio_automation_id ?? null;

    if (!res.ok || !zernioId) {
      return new Response(
        JSON.stringify({ ok: false, status: res.status, response: res.data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("social_flows")
      .update({ zernio_automation_id: zernioId, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", flow_id);

    return new Response(
      JSON.stringify({ ok: true, zernio_automation_id: zernioId, payload_sent: payload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
