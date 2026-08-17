// smart-ops-evogo-qr — QR de pareamento da instância EvolutionGO (wuzapi, :8081).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DEFAULT_BASE = "http://82.25.75.61:8081";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(url: string, token: string, init: RequestInit = {}, timeoutMs = 20_000) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { apikey: token, token, "Content-Type": "application/json", ...(init.headers ?? {}) },
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

async function toDataUrl(body: any): Promise<string | null> {
  const raw = body?.data?.QRCode ?? body?.data?.qrcode ?? body?.QRCode ?? body?.qrcode ?? body?.data?.code;
  if (typeof raw !== "string" || raw.length < 20) return null;
  if (raw.startsWith("data:image")) return raw;
  if (/^[A-Za-z0-9+/=]{200,}$/.test(raw)) return `data:image/png;base64,${raw}`;
  try { return await QRCode.toDataURL(raw, { width: 512, margin: 1 }); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { member_id, instance_token, base_url } = await req.json().catch(() => ({} as any));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let base = (base_url || DEFAULT_BASE).replace(/\/+$/, "");
    let token = (instance_token ?? "").trim();

    if (member_id) {
      const { data: m } = await supabase
        .from("team_members")
        .select("evo_go_base_url, evo_go_instance_token")
        .eq("id", member_id)
        .maybeSingle();
      if (m) {
        base = ((m.evo_go_base_url || base) as string).replace(/\/+$/, "");
        token = token || (m.evo_go_instance_token ?? "");
      }
    }
    if (!token) return json({ error: "missing_token", state: "unknown" }, 400);

    const st = await call(`${base}/instance/status`, token, { method: "GET" }, 8_000);
    if (st.ok && st.body?.data?.Connected === true && st.body?.data?.LoggedIn === true) {
      return json({ ok: true, state: "open", qrcode: null });
    }

    const debug: Record<string, unknown> = { status_http: st.status };

    // Garante sessão ativa antes de pedir o QR
    const conn = await call(`${base}/session/connect`, token, {
      method: "POST",
      body: JSON.stringify({ Subscribe: ["Message"], Immediate: true }),
    }, 15_000);
    debug.connect_http = conn.status;

    let qr: string | null = null;
    for (let i = 0; i < 4 && !qr; i++) {
      await sleep(i === 0 ? 800 : 2000);
      const r = await call(`${base}/session/qr`, token, { method: "GET" }, 15_000);
      debug[`qr${i + 1}_http`] = r.status;
      qr = await toDataUrl(r.body);
    }

    return json({ ok: !!qr, state: qr ? "connecting" : "close", qrcode: qr, debug: qr ? undefined : debug });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
