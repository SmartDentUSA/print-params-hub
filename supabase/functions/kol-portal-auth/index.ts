// Acesso ao portal do KOL (contrato, comissão, equipamentos, financeiro).
// Exige código (OTP) enviado pelo WhatsApp do CS ao celular cadastrado do KOL.
// A agenda pública de eventos NÃO usa esta função (continua só com celular).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_TRIES = 5;
const SESSION_TTL_MS = 12 * 3600_000;
const FAIL_WINDOW_MS = 15 * 60_000;
const BLOCK_MS = 3600_000;

async function sha(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const ipOf = (req: Request) =>
  (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

async function kolLog(leadId: string, type: string, data: Record<string, unknown>) {
  const { error } = await admin.rpc("fn_kol_log", {
    _lead_id: leadId, _event_type: type, _entity_type: "kol_portal", _entity_id: null, _entity_name: null,
    _data: { ...data, actor: "kol" }, _value: null, _channel: "kol",
  });
  if (error) console.error("[kol-portal-auth] fn_kol_log", type, error.message);
}

async function isBlocked(pid: string | null, ipHash: string) {
  const q = admin.from("kol_portal_attempts").select("blocked_until").gt("blocked_until", new Date().toISOString()).limit(1);
  const { data } = pid ? await q.or(`professional_id.eq.${pid},ip_hash.eq.${ipHash}`) : await q.eq("ip_hash", ipHash);
  return data?.[0]?.blocked_until ?? null;
}

async function registerFail(pid: string | null, ipHash: string, motivo: string) {
  await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false });
  const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString();
  const { count } = await admin.from("kol_portal_attempts").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).eq("success", false).gte("created_at", since);
  let until: string | null = null;
  if ((count ?? 0) >= 5) {
    until = new Date(Date.now() + BLOCK_MS).toISOString();
    await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false, blocked_until: until });
  }
  if (pid) {
    await kolLog(pid, "kol_portal_login_failed", {
      descricao: until ? "Portal bloqueado por 1 hora" : `Falha de acesso ao portal (${motivo})`,
      motivo, bloqueado_ate: until, dedupe_key: `kol_portal_failed:${pid}:${Date.now()}`,
    });
  }
  return until;
}

async function findKol(phone: string) {
  const key = phone.replace(/\D/g, "").slice(-10);
  if (key.length !== 10) return null;
  const { data } = await admin.from("lia_attendances")
    .select("id, nome, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
    .eq("kol_phone_key", key).eq("is_kol", true).is("merged_into", null).limit(2);
  return data && data.length === 1 ? { ...data[0], key } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const ipHash = await sha(`kolportal:${ipOf(req)}`);

    if (action === "request_otp") {
      const phone = String(body?.phone ?? "");
      if (phone.replace(/\D/g, "").length < 10 || phone.length > 30) return json({ error: "Informe o celular com DDD." }, 400);
      const kol = await findKol(phone);
      const blocked = await isBlocked(kol?.id ?? null, ipHash);
      if (blocked) return json({ error: "Acesso bloqueado por 1 hora. Fale com a equipe.", blocked_until: blocked }, 429);
      // Resposta genérica: não revela se o celular é de um KOL
      const generic = { ok: true, message: "Se o celular for de um KOL cadastrado, o código chega pelo WhatsApp." };
      if (!kol) { await registerFail(null, ipHash, "celular_desconhecido"); return json(generic); }

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const { data: sess, error } = await admin.from("kol_access_sessions").insert({
        lead_id: kol.id, phone_key: kol.key, otp_required: true,
        otp_hash: await sha(`${kol.id}:${code}`), otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      }).select("id").single();
      if (error) throw error;

      let to = (kol.prof_wa_number ? `${kol.prof_wa_ddi || "55"}${kol.prof_wa_number}` : "") || kol.wa_phone || kol.telefone_normalized || "";
      to = String(to).replace(/\D/g, "");
      if (to.length === 10 || to.length === 11) to = "55" + to;
      const instance = Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
      const { data: cs } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
      const first = String(kol.nome || "").trim().split(" ")[0];
      const message = `Olá${first ? `, ${first}` : ""}! Seu código de acesso ao portal Smart Dent é *${code}*. Ele vale por 10 minutos. Não compartilhe com ninguém.`;
      const { data: sent, error: sendErr } = cs
        ? await admin.functions.invoke("smart-ops-wa-send", {
          body: { to, message, lead_id: kol.id, team_member_id: cs.id, source: "kol_portal_otp" },
        })
        : { data: null, error: new Error("WhatsApp do CS não encontrado") };
      const sendOk = !sendErr && sent?.success !== false && !sent?.error;
      await kolLog(kol.id, "kol_portal_otp_sent", {
        descricao: sendOk ? "Código de acesso enviado por WhatsApp" : "Falha ao enviar código de acesso",
        enviado: sendOk, erro: sendOk ? null : String(sendErr?.message ?? sent?.error ?? "").slice(0, 300),
        dedupe_key: `kol_otp:${sess.id}`,
      });
      if (!sendOk) console.error("[kol-portal-auth] envio OTP", sendErr?.message ?? sent?.error);
      return json(generic);
    }

    if (action === "verify_otp") {
      const phone = String(body?.phone ?? "");
      const code = String(body?.code ?? "").replace(/\D/g, "");
      const kol = await findKol(phone);
      const blocked = await isBlocked(kol?.id ?? null, ipHash);
      if (blocked) return json({ error: "Acesso bloqueado por 1 hora. Fale com a equipe.", blocked_until: blocked }, 429);
      if (!kol || code.length !== 6) { await registerFail(kol?.id ?? null, ipHash, "codigo_invalido"); return json({ error: "Código inválido." }, 401); }
      const { data: sess } = await admin.from("kol_access_sessions").select("id, otp_hash, otp_expires_at, otp_attempts")
        .eq("lead_id", kol.id).is("verified_at", null).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const expired = !sess || !sess.otp_expires_at || new Date(sess.otp_expires_at).getTime() < Date.now() || sess.otp_attempts >= OTP_MAX_TRIES;
      if (expired || sess!.otp_hash !== await sha(`${kol.id}:${code}`)) {
        if (sess) await admin.from("kol_access_sessions").update({ otp_attempts: sess.otp_attempts + 1 }).eq("id", sess.id);
        const until = await registerFail(kol.id, ipHash, expired ? "codigo_expirado" : "codigo_errado");
        return json({ error: until ? "Acesso bloqueado por 1 hora." : "Código inválido ou expirado." }, until ? 429 : 401);
      }
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await admin.from("kol_access_sessions").update({
        verified_at: new Date().toISOString(), otp_hash: null, token_hash: await sha(token),
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      }).eq("id", sess!.id);
      await admin.from("kol_portal_attempts").insert({ professional_id: kol.id, ip_hash: ipHash, success: true });
      await kolLog(kol.id, "kol_portal_login", {
        descricao: "Acesso ao portal com código do WhatsApp", metodo: "otp_whatsapp", celular_verificado: true,
        dedupe_key: `kol_portal_login_otp:${sess!.id}`,
      });
      return json({ ok: true, session_token: token, expires_in: SESSION_TTL_MS / 1000 });
    }

    if (action === "session") {
      const token = String(body?.session_token ?? "");
      if (token.length !== 64) return json({ error: "unauthorized" }, 401);
      const { data: s } = await admin.from("kol_access_sessions").select("lead_id, expires_at, revoked_at")
        .eq("token_hash", await sha(token)).maybeSingle();
      if (!s || s.revoked_at || !s.expires_at || new Date(s.expires_at).getTime() < Date.now()) return json({ error: "unauthorized" }, 401);
      const { data: lead } = await admin.from("lia_attendances").select("nome, is_kol").eq("id", s.lead_id).is("merged_into", null).maybeSingle();
      if (!lead?.is_kol) return json({ error: "unauthorized" }, 401);
      return json({ ok: true, kol: { name: lead.nome }, expires_at: s.expires_at });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[kol-portal-auth]", e);
    return json({ error: "internal_error" }, 500);
  }
});
