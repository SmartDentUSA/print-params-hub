import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postBinding } from "./post-binding.ts";
import { fillCouponTemplate, pickCouponPhase, saoPauloToday } from "./coupon-phase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_ID = "6a1e1a2368fd70c014724ef0";
const ACCOUNT_ID = "6aeb13723e35d4bb52691137";
const ZERNIO_BASE = "https://zernio.com/api/v1/comment-automations";

// A Zernio envia o texto literal: nenhum {{placeholder}} é interpolado.
function stripPlaceholders(s: string): string {
  return String(s ?? "")
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ,/g, ",")
    .trim();
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
    matchMode: c.match_mode === "exact" ? "exact" : "contains",
    ...postBinding(c),
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

    if (body?.inspect_post_shortcode) {
      const shortcode = String(body.inspect_post_shortcode);
      if (!/^[\w-]{5,30}$/.test(shortcode)) throw new Error("invalid_shortcode");
      const r = await fetch(`https://zernio.com/api/v1/accounts/${ACCOUNT_ID}/posts`, {
        headers: { Authorization: `Bearer ${zernioKey}` }, signal: AbortSignal.timeout(20_000),
      });
      const data = await r.json();
      const posts = data.posts ?? data.data?.posts ?? [];
      const matches = posts.filter((p: any) => JSON.stringify(p).includes(shortcode));
      return new Response(JSON.stringify({ status: r.status, matches, total: posts.length, ...(!r.ok ? { error: data } : {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- modo diagnóstico: lê a automação e os logs na Zernio
    // liga/desliga ou ajusta modo de correspondência de uma automação (somente esses campos)
    if (body?.patch_automation_id) {
      const patch: Record<string, unknown> = {};
      if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
      if (body.matchMode === "exact" || body.matchMode === "contains") patch.matchMode = body.matchMode;
      const r = await zernioCall(zernioKey, `${ZERNIO_BASE}/${String(body.patch_automation_id)}`, "PATCH", patch);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body?.inspect_automation_id) {
      const id = String(body.inspect_automation_id);
      const h = { Authorization: `Bearer ${zernioKey}` };
      const get = async (u: string) => {
        const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(20_000) });
        const t = await r.text();
        try { return { status: r.status, data: JSON.parse(t) }; } catch { return { status: r.status, data: t.slice(0, 2000) }; }
      };
      const out = {
        automation: await get(`${ZERNIO_BASE}/${id}`),
        logs: await get(`${ZERNIO_BASE}/${id}/logs`),
      };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- cupom por fase: troca a DM conforme a validade dos cupons (promotional_coupons) e
    // desliga a automação quando todos venceram. Idempotente; chamado pela rotina diária.
    if (body?.apply_coupon_phases) {
      // Outra data só em simulação: a troca real sempre usa a data de hoje em São Paulo.
      const dryRun = body.dry_run === true;
      const today = dryRun && /^\d{4}-\d{2}-\d{2}$/.test(String(body.today ?? "")) ? String(body.today) : saoPauloToday();
      const { data: flows, error: fErr } = await supabase
        .from("social_flows")
        .select("id, name, is_active, nodes, zernio_automation_id, zernio_automation_config")
        .eq("channel", "instagram")
        .not("zernio_automation_config->coupon_codes", "is", null);
      if (fErr) throw fErr;
      const results: any[] = [];
      for (const f of flows ?? []) {
        const c: any = f.zernio_automation_config ?? {};
        const codes: string[] = Array.isArray(c.coupon_codes) ? c.coupon_codes.map((x: unknown) => String(x)) : [];
        if (!codes.length || !c.dm_template) continue;
        const { data: coupons, error: cErr } = await supabase
          .from("promotional_coupons")
          .select("code, discount_type, discount_value, valid_from, valid_until, active")
          .in("code", codes);
        if (cErr) { results.push({ flow_id: f.id, ok: false, error: cErr.message }); continue; }
        const phase = pickCouponPhase((coupons ?? []) as any, today);
        if (phase.status === "active") {
          const dm = fillCouponTemplate(String(c.dm_template), phase.coupon);
          if (!f.is_active || (dm === c.dm_message && c.current_coupon === phase.coupon.code && f.zernio_automation_id)) {
            results.push({ flow_id: f.id, ok: true, coupon: phase.coupon.code, changed: false, active: f.is_active });
            continue;
          }
          const config = { ...c, dm_message: dm, current_coupon: phase.coupon.code, current_coupon_since: today };
          const payload = buildPayload({ ...f, zernio_automation_config: config });
          if (dryRun) { results.push({ flow_id: f.id, ok: true, dry_run: true, coupon: phase.coupon.code, dm }); continue; }
          const res = f.zernio_automation_id
            ? await zernioCall(zernioKey, `${ZERNIO_BASE}/${f.zernio_automation_id}`, "PATCH", { ...payload, isActive: true })
            : await zernioCall(zernioKey, ZERNIO_BASE, "POST", payload);
          const zid = res.data?.automation?.id ?? res.data?.id ?? f.zernio_automation_id ?? null;
          if (!res.ok || !zid) { results.push({ flow_id: f.id, ok: false, status: res.status, response: res.data }); continue; }
          const nodes = Array.isArray(f.nodes) ? (f.nodes as any[]).map((n) => n?.data?.nodeType === "send_dm"
            ? { ...n, data: { ...n.data, config: { ...(n.data.config ?? {}), message: dm } } } : n) : f.nodes;
          await supabase.from("social_flows").update({
            zernio_automation_id: zid, zernio_automation_config: config, nodes, updated_at: new Date().toISOString(),
          }).eq("id", f.id);
          results.push({ flow_id: f.id, ok: true, coupon: phase.coupon.code, changed: true });
        } else if (phase.status === "ended" && f.is_active) {
          if (dryRun) { results.push({ flow_id: f.id, ok: true, dry_run: true, ended: true }); continue; }
          if (f.zernio_automation_id) {
            const res = await zernioCall(zernioKey, `${ZERNIO_BASE}/${f.zernio_automation_id}`, "PATCH", { isActive: false });
            if (!res.ok) { results.push({ flow_id: f.id, ok: false, status: res.status, response: res.data }); continue; }
          }
          await supabase.from("social_flows").update({
            is_active: false, zernio_automation_config: { ...c, ended_on: today }, updated_at: new Date().toISOString(),
          }).eq("id", f.id);
          results.push({ flow_id: f.id, ok: true, ended: true });
        } else {
          results.push({ flow_id: f.id, ok: true, status: phase.status, changed: false });
        }
      }
      return new Response(JSON.stringify({ ok: true, today, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        const c = f.zernio_automation_config ?? {};
        if (!Array.isArray(c.keywords) || (c.keywords.length === 0 && !c.platform_post_id)) {
          results.push({ flow_id: f.id, name: f.name, ok: false, error: "sem_keywords" });
          continue;
        }
        try {
          const payload = buildPayload(f);
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
