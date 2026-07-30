// sentinela-register-webhooks — registra o fan-out da Evolution nas instâncias
// marcadas como captura ativa em sentinela_instances, SEM perder o webhook legado
// (evolution-webhook-handler continua recebendo tudo através do fan-out).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FANOUT_URL = `${SUPABASE_URL}/functions/v1/evolution-webhook-fanout`;
const DEFAULT_BASE = "http://82.25.75.61:8080";
const REQUIRED_EVENTS = [
  "APPLICATION_STARTUP",
  "CALL",
  "CHATS_DELETE",
  "CHATS_SET",
  "CHATS_UPDATE",
  "CHATS_UPSERT",
  "CONNECTION_UPDATE",
  "CONTACTS_SET",
  "CONTACTS_UPDATE",
  "CONTACTS_UPSERT",
  "GROUP_PARTICIPANTS_UPDATE",
  "GROUP_UPDATE",
  "GROUPS_UPSERT",
  "LABELS_ASSOCIATION",
  "LABELS_EDIT",
  "LOGOUT_INSTANCE",
  "MESSAGES_DELETE",
  "MESSAGES_SET",
  "MESSAGES_UPDATE",
  "MESSAGES_UPSERT",
  "PRESENCE_UPDATE",
  "QRCODE_UPDATED",
  "REMOVE_INSTANCE",
  "SEND_MESSAGE",
  "TYPEBOT_CHANGE_STATUS",
  "TYPEBOT_START",
];

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function parseWebhook(txt: string) {
  try {
    const j = JSON.parse(txt);
    return {
      url: j?.url ?? j?.webhook?.url ?? j?.webhookUrl ?? null,
      events: (j?.events ?? j?.webhook?.events ?? []) as string[],
      enabled: j?.enabled ?? j?.webhook?.enabled ?? null,
    };
  } catch {
    return { url: null, events: [] as string[], enabled: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = !!body?.dry_run;
  } catch { /* sem body */ }

  const { data: instances, error } = await sb
    .from("sentinela_instances")
    .select("instance_name, active")
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const names = (instances ?? []).map((i: any) => i.instance_name);
  const { data: members } = await sb
    .from("team_members")
    .select("evolution_instance_name, evolution_api_key, evolution_base_url")
    .in("evolution_instance_name", names.length ? names : ["__none__"]);

  const credsByInstance = new Map<string, any>();
  for (const m of (members ?? []) as any[]) {
    if (m.evolution_instance_name && m.evolution_api_key) credsByInstance.set(m.evolution_instance_name, m);
  }

  const results: any[] = [];

  for (const name of names) {
    const creds = credsByInstance.get(name);
    if (!creds) {
      results.push({ instance: name, status: "skipped", reason: "missing_credentials" });
      continue;
    }
    const base = String(creds.evolution_base_url || DEFAULT_BASE).replace(/\/$/, "");
    const apikey = creds.evolution_api_key as string;

    let current = { url: null as string | null, events: [] as string[], enabled: null as boolean | null };
    try {
      const r = await fetch(`${base}/webhook/find/${encodeURIComponent(name)}`, {
        headers: { apikey },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) current = parseWebhook(await r.text());
    } catch { /* segue com defaults */ }

    const events = Array.from(new Set([...(current.events ?? []), ...REQUIRED_EVENTS]));

    if (current.url === FANOUT_URL && REQUIRED_EVENTS.every((e) => (current.events ?? []).includes(e))) {
      results.push({ instance: name, status: "already_configured", url: current.url, events: current.events });
      continue;
    }

    if (dryRun) {
      results.push({ instance: name, status: "would_update", from: current.url, to: FANOUT_URL, events });
      continue;
    }

    const payload = {
      webhook: { enabled: true, url: FANOUT_URL, events, webhookByEvents: false, webhookBase64: false },
      // compat Evolution v1
      enabled: true,
      url: FANOUT_URL,
      events,
    };

    let ok = false;
    let httpStatus = 0;
    let respBody = "";
    try {
      const r = await fetch(`${base}/webhook/set/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      httpStatus = r.status;
      respBody = (await r.text().catch(() => "")).slice(0, 300);
      ok = r.ok;
    } catch (e) {
      respBody = String(e);
    }

    results.push({
      instance: name,
      status: ok ? "updated" : "failed",
      previous_url: current.url,
      new_url: FANOUT_URL,
      events,
      http: httpStatus,
      response: ok ? undefined : respBody,
    });

    try {
      await sb.from("system_health_logs").insert({
        function_name: "sentinela-register-webhooks",
        severity: ok ? "info" : "error",
        error_type: "evolution_webhook_register",
        details: { instance: name, previous_url: current.url, new_url: FANOUT_URL, events, http: httpStatus, response: respBody },
      });
    } catch { /* noop */ }
  }

  return new Response(JSON.stringify({ ok: true, dry_run: dryRun, fanout_url: FANOUT_URL, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});