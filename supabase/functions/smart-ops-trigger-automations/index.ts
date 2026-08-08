// smart-ops-trigger-automations — automações por gatilho (origem → ação)
// Origens: e-mail (abriu/clicou/respondeu), DM Instagram/Facebook/TikTok,
// WhatsApp recebido (instâncias Evolution ou Zernio).
// Ações: SMS (DisparoPro), E-mail (Gmail gateway), WhatsApp (Evolution).
// Anti-duplicidade: cada envio tem ID único (dedupe_hash) reservado via
// RPC atômica try_claim_trigger_automation_send — mesmo padrão dos envios
// para grupos de WhatsApp e dos fluxos de Instagram.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHORT_BASE = Deno.env.get("SHORT_LINK_BASE") ?? "https://admin.smartdent.com.br/l";
const DISPARO_PRO_URL = "https://apihttp.disparopro.com.br:8433/mt";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const TZ_OFFSET_MIN = -180; // America/Sao_Paulo (sem DST)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normalizeMessage = (m: string) => (m ?? "").replace(/\s+/g, " ").trim().toLowerCase();

function normalizePhone(raw?: string | null): string | null {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (digits.length < 10) return null;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const firstName = (n?: string | null) => String(n ?? "").trim().split(/\s+/)[0] ?? "";

/** Extrai o telefone de quem enviou a mensagem (Zernio grava em `username`
 *  para WhatsApp; formulários trazem "Phone number: ..." no corpo). */
function extractSenderPhone(
  candidates: (string | null | undefined)[],
  text?: string | null,
): string | null {
  for (const c of candidates) {
    const p = normalizePhone(c);
    if (p) return p;
  }
  const m = String(text ?? "").match(/(?:phone|telefone|whatsapp|celular)[^\d+]{0,12}([\d()\s.+-]{10,20})/i);
  if (m) {
    const p = normalizePhone(m[1]);
    if (p) return p;
  }
  return null;
}

function interpolate(tpl: string, ctx: Record<string, unknown>): string {
  return String(tpl ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = ctx[k];
    return v == null ? "" : String(v);
  });
}

/** Próximo horário permitido (janela + dias da semana) no fuso de São Paulo. */
function nextAllowedAt(
  from: Date,
  horaInicio: number,
  horaFim: number,
  diasSemana: number[],
): Date {
  const dias = diasSemana?.length ? diasSemana : [0, 1, 2, 3, 4, 5, 6];
  const cursor = new Date(from.getTime());
  for (let i = 0; i < 14 * 24; i++) {
    const local = new Date(cursor.getTime() + TZ_OFFSET_MIN * 60_000);
    const dow = local.getUTCDay();
    const hour = local.getUTCHours();
    if (dias.includes(dow) && hour >= horaInicio && hour <= horaFim) return cursor;
    // avança para o próximo início de hora
    cursor.setTime(cursor.getTime() + 60 * 60_000);
    cursor.setUTCMinutes(0, 0, 0);
  }
  return cursor;
}

const randomCode = (n = 8) =>
  Array.from({ length: n }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

// ───────────────────────── Detecção de gatilhos ─────────────────────────

interface TriggerHit {
  lead_id: string | null;
  ref: string;
  detail: Record<string, unknown>;
  text?: string | null;
}

async function detectHits(
  supabase: ReturnType<typeof createClient>,
  a: Record<string, any>,
  sinceIso: string,
): Promise<TriggerHit[]> {
  const cfg = (a.trigger_config ?? {}) as Record<string, any>;
  const keywords: string[] = Array.isArray(cfg.keywords)
    ? cfg.keywords.map((k: string) => String(k).toLowerCase()).filter(Boolean)
    : [];
  const matchesKeywords = (text?: string | null) => {
    if (!keywords.length) return true;
    const t = String(text ?? "").toLowerCase();
    return keywords.some((k) => t.includes(k));
  };

  const source = String(a.trigger_source ?? "email");
  const event = String(a.trigger_event ?? "opened");

  // ── E-mail: abriu / clicou / respondeu ──
  if (source === "email") {
    if (event === "replied") {
      const { data } = await supabase
        .from("lead_activity_log")
        .select("id, lead_id, event_timestamp, event_data")
        .in("event_type", ["email_reply_received", "email_replied"])
        .gte("event_timestamp", sinceIso)
        .limit(300);
      return (data ?? [])
        .filter((r: any) => matchesKeywords(JSON.stringify(r.event_data ?? {})))
        .map((r: any) => ({
          lead_id: r.lead_id,
          ref: `email_replied:${r.id}`,
          detail: { at: r.event_timestamp, source: "email_reply" },
        }));
    }
    const col = event === "clicked" ? "clicked_at" : "opened_at";
    let q = supabase
      .from("campaign_send_log")
      .select("id, lead_id, campaign_id, email, nome, telefone, opened_at, clicked_at")
      .not(col, "is", null)
      .gte(col, sinceIso)
      .limit(300);
    const campaignIds: string[] = Array.isArray(cfg.campaign_ids) ? cfg.campaign_ids : [];
    if (campaignIds.length) q = q.in("campaign_id", campaignIds);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({
      lead_id: r.lead_id,
      ref: `email_${event}:${r.id}`,
      detail: { campaign_id: r.campaign_id, at: r[col], email: r.email },
    }));
  }

  // ── WhatsApp recebido nas instâncias Evolution ──
  if (source === "whatsapp" && String(cfg.provider ?? "evolution") === "evolution") {
    let q = supabase
      .from("whatsapp_inbox")
      .select("id, lead_id, message_text, phone, instance_name, team_member_id, created_at, is_group")
      .eq("direction", "inbound")
      .eq("is_group", false)
      .gte("created_at", sinceIso)
      .limit(300);
    const memberIds: string[] = Array.isArray(cfg.team_member_ids) ? cfg.team_member_ids : [];
    const instances: string[] = Array.isArray(cfg.instance_names) ? cfg.instance_names : [];
    if (memberIds.length) q = q.in("team_member_id", memberIds);
    else if (instances.length) q = q.in("instance_name", instances);
    const { data } = await q;
    return (data ?? [])
      .filter((r: any) => matchesKeywords(r.message_text))
      .map((r: any) => ({
        lead_id: r.lead_id,
        ref: `wa_inbox:${r.id}`,
        text: r.message_text,
        detail: {
          instance: r.instance_name,
          team_member_id: r.team_member_id,
          phone: r.phone,
          at: r.created_at,
        },
      }));
  }

  // ── Zernio: WhatsApp / Instagram / Facebook / TikTok ──
  const channelMap: Record<string, string> = {
    whatsapp: "zernio_whatsapp",
    instagram: "zernio_instagram",
    facebook: "zernio_facebook",
    tiktok: "zernio_tiktok",
  };
  const channel = channelMap[source] ?? `zernio_${source}`;
  const { data } = await supabase
    .from("lead_activity_log")
    .select("id, lead_id, event_data, event_timestamp, source_channel")
    .eq("event_type", "social_dm_received")
    .eq("source_channel", channel)
    .gte("event_timestamp", sinceIso)
    .limit(300);
  return (data ?? [])
    .filter((r: any) => matchesKeywords((r.event_data as any)?.text ?? (r.event_data as any)?.message))
    .map((r: any) => {
      const ed = (r.event_data ?? {}) as Record<string, any>;
      // Zernio grava o conteúdo em `message`; `text` só existe em alguns canais.
      const text = ed.text ?? ed.message ?? null;
      return {
        lead_id: r.lead_id,
        ref: `social_dm:${r.id}`,
        text,
        detail: {
          channel: r.source_channel,
          at: r.event_timestamp,
          // WhatsApp via Zernio: o telefone do remetente vem em `username`.
          phone: extractSenderPhone([ed.phone, ed.from, ed.username, ed.sender_phone], text),
        },
      };
    });
}

// ───────────────────────── Envio por canal ─────────────────────────

async function sendSms(destino: string, message: string) {
  const token = Deno.env.get("DISPARO_PRO_TOKEN");
  if (!token) return { ok: false, error: "DISPARO_PRO_TOKEN não configurado" };
  const res = await fetch(DISPARO_PRO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        numero: destino,
        servico: Deno.env.get("DISPARO_PRO_SERVICO") || "short",
        mensagem: message,
        codificacao: "0",
        nome_campanha: "automacao_gatilho",
      },
    ]),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `disparopro_${res.status}: ${text.slice(0, 300)}` };
  let id: string | null = null;
  try {
    const parsed = JSON.parse(text);
    const detail = Array.isArray(parsed?.detail) ? parsed.detail[0] : parsed?.detail;
    id = detail?.id ?? null;
  } catch { /* ignore */ }
  return { ok: true, providerId: id };
}

async function sendWhatsApp(
  destino: string,
  message: string,
  teamMemberId: string | null,
  leadId: string | null,
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-wa-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      phone: destino,
      message,
      team_member_id: teamMemberId,
      lead_id: leadId,
      source: "trigger_automation",
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    return { ok: false, error: payload?.detail ?? payload?.error ?? `wa_send_${res.status}` };
  }
  return { ok: true, providerId: payload?.message_id ?? payload?.messageId ?? null };
}

function b64std(s: string) {
  return btoa(unescape(encodeURIComponent(s)));
}
const b64url = (s: string) => b64std(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sendEmail(destino: string, subject: string, html: string) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mailKey = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lovableKey || !mailKey) return { ok: false, error: "Conector Gmail não configurado" };
  const raw = [
    `To: ${destino}`,
    `Subject: =?UTF-8?B?${b64std(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64std(`<!doctype html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`)
      .replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
  const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mailKey,
    },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: payload?.error?.message ?? `gmail_${res.status}` };
  }
  return { ok: true, providerId: payload?.id ?? null };
}

// ───────────────────────── Handler ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode ?? "cycle"); // cycle | detect | dispatch | test

  try {
    // ── Teste manual: envia a mensagem da automação para um destino ──
    if (mode === "test") {
      const { automation_id, destino } = body ?? {};
      const { data: a } = await supabase
        .from("trigger_automations")
        .select("*")
        .eq("id", automation_id)
        .maybeSingle();
      if (!a) return json({ error: "automation_not_found" }, 404);
      const cfg = (a.action_config ?? {}) as Record<string, any>;
      const testClient = normalizePhone(body?.client_phone ?? destino) ?? "";
      const presetTest = interpolate(String(cfg.client_link_message ?? ""), {
        nome: "Teste",
        primeiro_nome: "Teste",
      });
      const msg = interpolate(String(cfg.mensagem ?? ""), {
        nome: "Teste",
        primeiro_nome: "Teste",
        link: cfg.link_url ?? "",
        mensagem_cliente: "mensagem de teste recebida no WhatsApp",
        canal_origem: a.trigger_source,
        telefone: testClient,
        link_cliente: testClient
          ? `https://wa.me/${testClient}${presetTest ? `?text=${encodeURIComponent(presetTest)}` : ""}`
          : "",
      });
      if (a.action_type === "sms") {
        const r = await sendSms(normalizePhone(destino) ?? "", msg);
        return json(r);
      }
      if (a.action_type === "email") {
        const r = await sendEmail(String(destino), String(cfg.assunto ?? a.nome), cfg.html ?? msg);
        return json(r);
      }
      const r = await sendWhatsApp(
        normalizePhone(destino) ?? "",
        msg,
        cfg.team_member_id ?? null,
        null,
      );
      return json(r);
    }

    const results: Record<string, unknown>[] = [];

    // ───────── DETECT: gatilhos → fila (com ID único) ─────────
    if (mode === "cycle" || mode === "detect") {
      const { data: automations } = await supabase
        .from("trigger_automations")
        .select("*")
        .eq("ativo", true)
        .order("prioridade", { ascending: true });

      for (const a of automations ?? []) {
        const lookbackMin = Number((a.trigger_config as any)?.lookback_minutes ?? 90);
        const sinceIso = a.last_run_at
          ? new Date(Math.max(Date.parse(a.last_run_at) - 60_000, Date.now() - lookbackMin * 60_000)).toISOString()
          : new Date(Date.now() - lookbackMin * 60_000).toISOString();

        let hits: TriggerHit[] = [];
        try {
          hits = await detectHits(supabase, a, sinceIso);
        } catch (e) {
          console.error(JSON.stringify({ event: "trigger.detect_fail", automation: a.id, error: String(e) }));
        }

        // Limite diário
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
          .from("trigger_automation_queue")
          .select("id", { count: "exact", head: true })
          .eq("automation_id", a.id)
          .gte("created_at", dayStart.toISOString());
        let budget = Math.max(Number(a.max_por_dia ?? 200) - (todayCount ?? 0), 0);

        let queued = 0;
        let skipped = 0;
        const cfg = (a.action_config ?? {}) as Record<string, any>;

        for (const hit of hits) {
          if (budget <= 0) break;
          if (!hit.lead_id) { skipped++; continue; }

          const { data: lead } = await supabase
            .from("lia_attendances")
            .select("id, nome, email, telefone, telefone_normalized, wa_phone, merged_into")
            .eq("id", hit.lead_id)
            .maybeSingle();
          if (!lead || lead.merged_into) { skipped++; continue; }

          const channel = String(a.action_type);
          const destinatario = String(cfg.destinatario ?? "lead"); // lead | interno
          // Telefone de quem mandou a mensagem tem prioridade sobre o cadastro.
          const leadPhone =
            extractSenderPhone(
              [
                (hit.detail as any)?.phone,
                lead.telefone_normalized,
                lead.telefone,
                (lead as any).wa_phone,
              ],
              hit.text,
            ) ?? null;

          // Destino interno: a mensagem vai para o celular de um membro do time
          // (ex.: suporte) com um link wa.me já apontando para o cliente.
          let internoPhone: string | null = null;
          if (destinatario === "interno") {
            internoPhone = normalizePhone(cfg.notify_phone);
            if (!internoPhone && cfg.notify_team_member_id) {
              const { data: nm } = await supabase
                .from("team_members")
                .select("evolution_phone, whatsapp_number")
                .eq("id", cfg.notify_team_member_id)
                .maybeSingle();
              internoPhone = normalizePhone((nm as any)?.evolution_phone ?? (nm as any)?.whatsapp_number);
            }
          }

          const destino =
            destinatario === "interno"
              ? internoPhone
              : channel === "email"
                ? String(lead.email ?? "").trim().toLowerCase()
                : leadPhone;
          if (!destino) { skipped++; continue; }

          // Cooldown por lead
          if (Number(a.cooldown_horas ?? 0) > 0) {
            const cutoff = new Date(Date.now() - Number(a.cooldown_horas) * 3600_000).toISOString();
            const { count: recent } = await supabase
              .from("trigger_automation_queue")
              .select("id", { count: "exact", head: true })
              .eq("automation_id", a.id)
              .eq("lead_id", lead.id)
              .neq("status", "failed")
              .gte("created_at", cutoff);
            if ((recent ?? 0) > 0) { skipped++; continue; }
          }

          // Link encurtado (usado principalmente no SMS)
          let shortUrl: string | null = null;
          if (cfg.link_url) {
            const code = randomCode(8);
            const { error: slErr } = await supabase.from("short_links").insert({
              code,
              destination_url: String(cfg.link_url),
              lead_id: lead.id,
              produto: `automacao:${a.nome}`,
            });
            if (!slErr) shortUrl = `${SHORT_BASE}/${code}`;
          }

          const ctx = {
            nome: lead.nome ?? "",
            primeiro_nome: firstName(lead.nome),
            link: shortUrl ?? cfg.link_url ?? "",
            email: lead.email ?? "",
            telefone: lead.telefone ?? "",
          };
          // Link wa.me para o suporte abrir a conversa com o cliente já com a
          // primeira mensagem pronta.
          const presetCliente = interpolate(String(cfg.client_link_message ?? ""), ctx);
          const linkCliente = leadPhone
            ? `https://wa.me/${leadPhone}${presetCliente ? `?text=${encodeURIComponent(presetCliente)}` : ""}`
            : "";
          (ctx as Record<string, unknown>).link_cliente = linkCliente;
          (ctx as Record<string, unknown>).mensagem_cliente = String(hit.text ?? "").slice(0, 400);
          (ctx as Record<string, unknown>).canal_origem = String(a.trigger_source ?? "");

          const tpl = String(cfg.mensagem ?? "");
          let message = interpolate(tpl, ctx);
          // Notificação interna: o link do cliente é obrigatório. Se o template
          // não referencia {{link_cliente}}, anexamos automaticamente com o
          // telefone de quem mandou a mensagem e a mensagem recebida.
          if (destinatario === "interno") {
            if (!leadPhone) { skipped++; continue; }
            if (!/\{\{\s*link_cliente\s*\}\}/.test(tpl)) {
              const recebida = String(hit.text ?? "").slice(0, 300);
              message =
                `${message.trim()}\n\n` +
                `👤 ${lead.nome ?? "Cliente"} — +${leadPhone}\n` +
                (recebida ? `💬 "${recebida}"\n` : "") +
                `➡️ Falar com o cliente: ${linkCliente}`;
            }
          }
          if (!message.trim()) { skipped++; continue; }

          const scheduledAt = nextAllowedAt(
            new Date(Date.now() + Number(a.delay_minutos ?? 0) * 60_000),
            Number(a.horario_inicio ?? 9),
            Number(a.horario_fim ?? 18),
            (a.dias_semana as number[]) ?? [1, 2, 3, 4, 5],
          );

          // ID único do envio — anti-duplicidade
          const dedupeHash = await sha256(
            [a.id, channel, destino, normalizeMessage(message)].join("|"),
          );

          const { data: claimed, error: claimErr } = await supabase.rpc(
            "try_claim_trigger_automation_send",
            {
              _automation_id: a.id,
              _lead_id: lead.id,
              _channel: channel,
              _destino: destino,
              _trigger_ref: hit.ref,
              _dedupe_hash: dedupeHash,
              _scheduled_at: scheduledAt.toISOString(),
              _prioridade: Number(a.prioridade ?? 100),
              _window_minutes: Number(a.dedupe_window_minutes ?? 1440),
              _rendered_message: message,
              _rendered_subject: channel === "email" ? interpolate(String(cfg.assunto ?? a.nome), ctx) : null,
              _short_link_url: shortUrl,
              _trigger_detail: hit.detail ?? {},
            },
          );
          if (claimErr) {
            console.error(JSON.stringify({ event: "trigger.claim_fail", error: claimErr.message }));
            skipped++;
            continue;
          }
          if (!claimed) { skipped++; continue; }
          queued++;
          budget--;
        }

        await supabase
          .from("trigger_automations")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", a.id);

        results.push({ automation: a.nome, hits: hits.length, queued, skipped });
      }
    }

    // ───────── DISPATCH: fila → envio ─────────
    let sent = 0;
    let failed = 0;
    if (mode === "cycle" || mode === "dispatch") {
      const limit = Number(body?.limit ?? 40);
      const { data: pending } = await supabase
        .from("trigger_automation_queue")
        .select("*, trigger_automations!inner(id, nome, action_config, action_type, ativo)")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("prioridade", { ascending: true })
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      for (const row of pending ?? []) {
        const auto = (row as any).trigger_automations ?? {};
        if (auto.ativo === false) {
          await supabase
            .from("trigger_automation_queue")
            .update({ status: "skipped", error_message: "automação inativa" })
            .eq("id", row.id);
          continue;
        }

        // Reserva a linha (evita corrida entre execuções do cron)
        const { data: locked } = await supabase
          .from("trigger_automation_queue")
          .update({ status: "sending" })
          .eq("id", row.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!locked) continue;

        const cfg = (auto.action_config ?? {}) as Record<string, any>;
        let result: { ok: boolean; error?: string; providerId?: string | null };
        if (row.channel === "sms") {
          result = await sendSms(String(row.destino), String(row.rendered_message ?? ""));
        } else if (row.channel === "email") {
          result = await sendEmail(
            String(row.destino),
            String(row.rendered_subject ?? auto.nome ?? "Smart Dent"),
            String(cfg.html ?? row.rendered_message ?? ""),
          );
        } else {
          result = await sendWhatsApp(
            String(row.destino),
            String(row.rendered_message ?? ""),
            cfg.team_member_id ?? null,
            row.lead_id ?? null,
          );
        }

        await supabase
          .from("trigger_automation_queue")
          .update({
            status: result.ok ? "sent" : "failed",
            sent_at: result.ok ? new Date().toISOString() : null,
            provider_message_id: result.providerId ?? null,
            error_message: result.ok ? null : String(result.error ?? "erro desconhecido").slice(0, 500),
          })
          .eq("id", row.id);

        // Timeline do lead: sempre registra (sucesso ou falha), sempre sem
        // duplicação — dedupe_hash único por envio (índice uq_lal_dedupe).
        if (row.lead_id) {
          const canalLabel = row.channel === "sms"
            ? "SMS"
            : row.channel === "email"
            ? "E-mail"
            : "WhatsApp";
          const icon = row.channel === "sms" ? "📲" : row.channel === "email" ? "✉️" : "💬";
          const evt = result.ok
            ? `automation_${row.channel}_sent`
            : `automation_${row.channel}_failed`;
          const { error: talErr } = await supabase.from("lead_activity_log").insert({
            lead_id: row.lead_id,
            event_type: evt,
            entity_type: "trigger_automation",
            entity_id: String(row.id),
            entity_name: auto.nome ?? "Automação por gatilho",
            source_channel: row.channel === "email" ? "email" : row.channel,
            event_timestamp: new Date().toISOString(),
            dedupe_hash: `trigger_automation:${row.channel}:${row.dedupe_hash}`,
            event_data: {
              kind: "automacao",
              kind_label: result.ok
                ? `${canalLabel} enviado (automação)`
                : `Falha no envio de ${canalLabel} (automação)`,
              icon,
              automation: auto.nome,
              automation_id: auto.id,
              canal: row.channel,
              destino: row.destino,
              assunto: row.rendered_subject ?? null,
              mensagem: row.rendered_message,
              short_link: row.short_link_url,
              trigger_ref: row.trigger_ref ?? null,
              status: result.ok ? "enviado" : "falhou",
              erro: result.ok ? null : String(result.error ?? "").slice(0, 300),
              provider_message_id: result.providerId ?? null,
              fonte: "trigger_automation",
              dedupe_key: `trigger_automation:${row.dedupe_hash}`,
            },
          });
          if (talErr && !/duplicate key|23505/i.test(`${talErr.code} ${talErr.message}`)) {
            console.error(JSON.stringify({ event: "trigger.timeline_error", queue_id: row.id, error: talErr.message }));
          }
        }

        if (result.ok) sent++;
        else failed++;
      }
    }

    return json({ ok: true, mode, sent, failed, results });
  } catch (e) {
    console.error(JSON.stringify({ event: "trigger.fatal", error: String((e as Error)?.message ?? e) }));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});