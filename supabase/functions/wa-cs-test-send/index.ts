// TEMP: teste manual de envio pelo celular do CS (Evolution individual + EvolutionGO grupo + SMS DisparoPro).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const strip = (u: string) => (u || "").replace(/\/+$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const groupQuery: string = body.group_query ?? "Software Scan BLZ";
  const phone: string = String(body.phone ?? "5519992612348").replace(/\D/g, "");
  const smsPhone: string = String(body.sms_phone ?? "5516997322333").replace(/\D/g, "");
  const npsLink: string = body.nps_link ?? "";
  const groupText: string = body.group_text ?? "";
  const dmText: string = body.dm_text ?? "";
  const out: Record<string, unknown> = {};

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tm } = await supabase
    .from("team_members")
    .select("evolution_instance_name, evolution_api_key, evolution_base_url, evolution_status, evo_go_instance_name, evo_go_instance_id, evo_go_instance_token, evo_go_base_url, evo_go_status")
    .eq("evolution_instance_name", "cs_principal")
    .maybeSingle();
  if (!tm) return Response.json({ error: "cs_principal not found" }, { headers: corsHeaders });

  const evo = { base: strip(tm.evolution_base_url || "http://82.25.75.61:8080"), inst: tm.evolution_instance_name!, key: tm.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY") || "" };
  const go = { base: strip(tm.evo_go_base_url || "http://82.25.75.61:8081"), inst: tm.evo_go_instance_name || tm.evo_go_instance_id || "", key: tm.evo_go_instance_token || "" };

  // 1) Grupo via EvolutionGO
  const directJid: string = body.group_jid ?? "";
  const viaEvo: boolean = body.group_via_evolution === true;
  if (viaEvo && directJid && groupText) {
    try {
      const r = await fetch(`${go.base}/session/status`, { headers: { apikey: go.key }, signal: AbortSignal.timeout(20_000) });
      out.evogo_session = { status: r.status, body: (await r.text()).slice(0, 300) };
    } catch (e) { out.evogo_session = { error: String((e as Error).message ?? e) }; }
    try {
      const res = await fetch(`${evo.base}/message/sendText/${encodeURIComponent(evo.inst)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evo.key },
        body: JSON.stringify({ number: directJid, text: groupText }),
        signal: AbortSignal.timeout(60_000),
      });
      out.group_send_evolution = { status: res.status, body: (await res.text()).slice(0, 300), jid: directJid };
    } catch (e) { out.group_error = String((e as Error).message ?? e); }
    console.log("[wa-cs-test-send]", JSON.stringify(out));
    return Response.json({ ok: true, ...out });
  }
  if (directJid && groupText) {
    try {
      const res = await fetch(`${go.base}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: go.key },
        body: JSON.stringify({ number: directJid, text: groupText }),
        signal: AbortSignal.timeout(60_000),
      });
      out.group_send = { status: res.status, body: (await res.text()).slice(0, 400), jid: directJid };
    } catch (e) { out.group_error = String((e as Error).message ?? e); }
  } else if (groupText) try {
    const gr = await fetch(`${evo.base}/group/fetchAllGroups/${encodeURIComponent(evo.inst)}?getParticipants=false`, {
      headers: { "Content-Type": "application/json", apikey: evo.key },
      signal: AbortSignal.timeout(120_000),
    });
    const rawTxt = await gr.text();
    out.group_fetch = { status: gr.status, sample: rawTxt.slice(0, 300) };
    let groups: any = [];
    try { groups = JSON.parse(rawTxt); } catch { groups = []; }
    if (groups && !Array.isArray(groups)) groups = groups.groups ?? groups.data ?? [];
    out.group_count = Array.isArray(groups) ? groups.length : 0;
    const norm = (s: string) => (s || "").toLowerCase();
    const matches = (Array.isArray(groups) ? groups : []).filter((g: any) => norm(g.subject ?? g.name ?? g.Name ?? g.GroupName).includes(norm(groupQuery)));
    out.group_candidates = matches.map((g: any) => ({ id: g.id ?? g.JID ?? g.jid, subject: g.subject ?? g.name ?? g.Name ?? g.GroupName }));
    if (matches.length === 1 && groupText) {
      const jid = matches[0].id ?? matches[0].JID ?? matches[0].jid;
      const res = await fetch(`${go.base}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: go.key },
        body: JSON.stringify({ number: jid, text: groupText }),
        signal: AbortSignal.timeout(60_000),
      });
      out.group_send = { status: res.status, body: (await res.text()).slice(0, 400), jid };
    }
  } catch (e) { out.group_error = String((e as Error).message ?? e); }

  // 2) DM via Evolution individual
  if (dmText) {
    try {
      const res = await fetch(`${evo.base}/message/sendText/${encodeURIComponent(evo.inst)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evo.key },
        body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, text: dmText }),
        signal: AbortSignal.timeout(60_000),
      });
      out.dm_send = { status: res.status, body: (await res.text()).slice(0, 400) };
    } catch (e) { out.dm_error = String((e as Error).message ?? e); }
  }

  // 3) SMS via DisparoPro
  if (npsLink) {
    try {
      const token = Deno.env.get("DISPARO_PRO_TOKEN");
      const msg = String(body.sms_text ?? `Smart Dent: avalie seu treinamento em 1 min: ${npsLink}`);
      const res = await fetch("https://apihttp.disparopro.com.br:8433/mt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify([{ numero: smsPhone, servico: "short", mensagem: msg, codificacao: "0", nome_campanha: "teste_nps" }]),
        signal: AbortSignal.timeout(60_000),
      });
      out.sms_send = { status: res.status, body: (await res.text()).slice(0, 600), chars: msg.length };
    } catch (e) { out.sms_error = String((e as Error).message ?? e); }
  }

  console.log("[wa-cs-test-send]", JSON.stringify(out));
  return Response.json({ ok: true, ...out }, { headers: corsHeaders });
});
