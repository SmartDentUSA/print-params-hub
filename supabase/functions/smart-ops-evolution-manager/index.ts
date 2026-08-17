// smart-ops-evolution-manager — status / QR de instâncias Evolution API (:8080).
// Ações: get_status | get_qr | logout | restart
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DEFAULT_BASE = "http://82.25.75.61:8080";
const enc = (s: string) => encodeURIComponent(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(url: string, apikey: string, init: RequestInit = {}, timeoutMs = 25_000) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { apikey, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => "");
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String(e) };
  }
}

function extractState(body: any): string | null {
  return body?.instance?.state ?? body?.state ?? body?.instance?.connectionStatus ?? null;
}

async function toDataUrl(qr: any): Promise<string | null> {
  const base64: string | undefined = qr?.base64 ?? qr?.qrcode?.base64;
  if (typeof base64 === "string" && base64.length > 100) {
    return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
  }
  const code: string | undefined = qr?.code ?? qr?.qrcode?.code ?? qr?.qr;
  if (typeof code === "string" && code.length > 20) {
    try { return await QRCode.toDataURL(code, { width: 512, margin: 1 }); } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, instance_name, member_id } = await req.json().catch(() => ({} as any));
    if (!action) return json({ error: "action required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let base = DEFAULT_BASE;
    let apikey = Deno.env.get("EVO_KEY") ?? "";
    let instance = (instance_name ?? "").trim();

    if (member_id) {
      const { data: m } = await supabase
        .from("team_members")
        .select("evolution_base_url, evolution_instance_name, evolution_api_key")
        .eq("id", member_id)
        .maybeSingle();
      if (m) {
        base = (m.evolution_base_url || DEFAULT_BASE).replace(/\/+$/, "");
        apikey = m.evolution_api_key || apikey;
        instance = instance || (m.evolution_instance_name ?? "");
      }
    } else if (instance) {
      const { data: m } = await supabase
        .from("team_members")
        .select("evolution_base_url, evolution_api_key")
        .eq("evolution_instance_name", instance)
        .not("evolution_api_key", "is", null)
        .limit(1)
        .maybeSingle();
      if (m) {
        base = (m.evolution_base_url || DEFAULT_BASE).replace(/\/+$/, "");
        apikey = m.evolution_api_key || apikey;
      }
    }
    base = (base || DEFAULT_BASE).replace(/\/+$/, "");
    if (!instance) return json({ error: "instance_name required" }, 400);
    if (!apikey) return json({ error: "missing_apikey", instance_name: instance }, 400);

    const statusOf = async () => {
      let r = await call(`${base}/instance/connectionState/${enc(instance)}`, apikey, { method: "GET" }, 10_000);
      if (!r.ok && r.status === 401 && Deno.env.get("EVO_KEY")) {
        r = await call(`${base}/instance/connectionState/${enc(instance)}`, Deno.env.get("EVO_KEY")!, { method: "GET" }, 10_000);
      }
      return r;
    };

    if (action === "get_status") {
      const r = await statusOf();
      const state = extractState(r.body) ?? "unknown";
      return json({ ok: r.ok, state, connected: state === "open", data: r.body, http: r.status });
    }

    if (action === "logout") {
      const r = await call(`${base}/instance/logout/${enc(instance)}`, apikey, { method: "DELETE" }, 20_000);
      return json({ ok: r.ok, http: r.status, data: r.body });
    }

    if (action === "restart") {
      const r = await call(`${base}/instance/restart/${enc(instance)}`, apikey, { method: "POST" }, 20_000);
      return json({ ok: r.ok, http: r.status, data: r.body });
    }

    if (action === "get_qr") {
      const st = await statusOf();
      const state0 = extractState(st.body);
      if (state0 === "open") {
        return json({ ok: true, instance_name: instance, state: "open", qrcode: null, source: "connectionState" });
      }

      const debug: Record<string, unknown> = { state0, status_http: st.status };

      // 1ª tentativa: /instance/connect
      let attempt = await call(`${base}/instance/connect/${enc(instance)}`, apikey, { method: "GET" }, 25_000);
      let qr = await toDataUrl(attempt.body);
      debug.connect_http = attempt.status;
      if (attempt.error) debug.connect_error = attempt.error;

      // Instância travada em "close": restart e novas tentativas
      if (!qr) {
        const rs = await call(`${base}/instance/restart/${enc(instance)}`, apikey, { method: "POST" }, 20_000);
        debug.restart_http = rs.status;
        for (let i = 0; i < 3 && !qr; i++) {
          await sleep(2500);
          attempt = await call(`${base}/instance/connect/${enc(instance)}`, apikey, { method: "GET" }, 25_000);
          debug[`retry${i + 1}_http`] = attempt.status;
          if (attempt.error) debug[`retry${i + 1}_error`] = attempt.error;
          const s = extractState(attempt.body);
          if (s === "open") {
            return json({ ok: true, instance_name: instance, state: "open", qrcode: null, source: "connect" });
          }
          qr = await toDataUrl(attempt.body);
        }
      }

      return json({
        ok: !!qr,
        instance_name: instance,
        state: qr ? "connecting" : (extractState(attempt.body) ?? "unknown"),
        qrcode: qr,
        pairing_code: attempt.body?.pairingCode ?? null,
        raw_status: attempt.status,
        source: "connect",
        debug: qr ? undefined : debug,
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
