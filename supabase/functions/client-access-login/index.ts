// client-access-login — login de clientes por celular (magic link por SMS).
// Ações: request (envia link), lookup (dados do token), confirm (cria sessão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const FN = "client-access-login";
const DISPARO_PRO_URL = "https://apihttp.disparopro.com.br:8433/mt";
const DISPARO_PRO_SERVICO = Deno.env.get("DISPARO_PRO_SERVICO") || "short";
const PUBLIC_BASE = (Deno.env.get("NPS_PUBLIC_BASE_URL") ?? "https://parametros.smartdent.com.br").replace(/\/+$/, "");
const SHORT_BASE = (Deno.env.get("SHORT_LINK_BASE_R") ?? "https://admin.smartdent.com.br/r").replace(/\/+$/, "");
const TOKEN_TTL_MIN = 15;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizePhone(raw: string): string {
  const d = String(raw || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}
function maskPhone(p: string): string {
  const d = p.replace(/\D+/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length < 8) return `(••) ••••-${local.slice(-4)}`;
  return `(${local.slice(0, 2)}) ••••-${local.slice(-4)}`;
}
function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function randomCode(len = 6): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}
function firstName(n?: string | null): string {
  const s = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}
function technicalEmail(phone: string): string {
  return `${phone}@phone.smartdent.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const log = async (severity: string, error_type: string, details: unknown) => {
    try { await supabase.from("system_health_logs").insert({ function_name: FN, severity, error_type, details }); } catch { /* noop */ }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "request");

    // ---------- 1. Login direto pelo celular (base de clientes) ----------
    if (action === "request" || action === "direct") {
      const phone = normalizePhone(body?.phone);
      if (phone.length < 12) return json({ ok: false, error: "Informe um celular válido com DDD." }, 400);

      const local = phone.slice(2);
      const variants = [phone, local];
      // 9º dígito: tenta com e sem
      if (local.length === 11) variants.push(`55${local.slice(0, 2)}${local.slice(3)}`);
      if (local.length === 10) variants.push(`55${local.slice(0, 2)}9${local.slice(2)}`);

      let lead: { id: string; nome: string | null } | null = null;
      for (const v of variants) {
        const digits = v.replace(/\D+/g, "").slice(-10);
        const { data, error: eSel } = await supabase
          .from("lia_attendances")
          .select("id, nome, telefone_normalized, telefone_raw")
          .is("merged_into", null)
          .or(`telefone_normalized.ilike.%${digits}%,telefone_raw.ilike.%${digits}%`)
          .limit(1);
        if (eSel) await log("error", "lead_lookup_failed", { message: eSel.message });
        if (data?.[0]) { lead = { id: data[0].id, nome: data[0].nome }; break; }
      }

      // Sem cadastro na base de clientes → não libera acesso.
      if (!lead) {
        return json({ ok: false, error: "Não encontramos este celular na nossa base de clientes." }, 404);
      }

      const email = technicalEmail(phone);
      const { data: created, error: eCreate } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome: lead.nome, phone, lead_id: lead.id, tipo: "cliente" },
      });
      if (eCreate && !/already/i.test(eCreate.message)) throw eCreate;
      let userId = created?.user?.id ?? null;
      if (!userId) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list?.users?.find((u) => u.email === email)?.id ?? null;
      }

      const { data: linkData, error: eLink } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
      if (eLink) throw eLink;
      const hashed = linkData?.properties?.hashed_token;
      if (!hashed) throw new Error("Falha ao gerar sessão.");

      const nowIso = new Date().toISOString();
      await supabase.from("client_access_invites").insert({
        lead_id: lead.id,
        nome: lead.nome,
        destino: phone,
        canal: "direto",
        token: newToken(),
        status: "confirmado",
        confirmed_at: nowIso,
        first_login_at: nowIso,
        last_seen_at: nowIso,
        user_id: userId,
      });

      return json({
        ok: true,
        email,
        token_hash: hashed,
        nome: lead.nome,
        phone_masked: maskPhone(phone),
      });
    }

    // ---------- 2. Ler token ----------
    if (action === "lookup" || action === "confirm") {
      const token = String(body?.token || "").trim();
      if (!token) return json({ ok: false, error: "Token ausente." }, 400);

      const { data: invite } = await supabase
        .from("client_access_invites")
        .select("id, nome, destino, sent_at, confirmed_at, user_id, lead_id")
        .eq("token", token)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!invite) return json({ ok: false, error: "Link inválido." }, 404);

      const ageMin = (Date.now() - new Date(invite.sent_at as string).getTime()) / 60000;
      if (!invite.confirmed_at && ageMin > TOKEN_TTL_MIN) {
        return json({ ok: false, error: "Link expirado. Solicite um novo acesso." }, 410);
      }

      if (action === "lookup") {
        return json({ ok: true, nome: invite.nome, phone_masked: maskPhone(String(invite.destino)) });
      }

      // ---------- 3. Confirmar celular -> sessão ----------
      const phone = normalizePhone(String(invite.destino));
      const email = technicalEmail(phone);

      let userId = invite.user_id as string | null;
      if (!userId) {
        const { data: created, error: eCreate } = await supabase.auth.admin.createUser({
          email,
          phone_confirm: false,
          email_confirm: true,
          user_metadata: { nome: invite.nome, phone, lead_id: invite.lead_id, tipo: "cliente" },
        });
        if (eCreate && !/already/i.test(eCreate.message)) throw eCreate;
        userId = created?.user?.id ?? null;
        if (!userId) {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          userId = list?.users?.find((u) => u.email === email)?.id ?? null;
        }
      }

      const { data: linkData, error: eLink } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
      if (eLink) throw eLink;
      const hashed = linkData?.properties?.hashed_token;
      if (!hashed) throw new Error("Falha ao gerar sessão.");

      await supabase.from("client_access_invites").update({
        confirmed_at: invite.confirmed_at ?? new Date().toISOString(),
        first_login_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        user_id: userId,
        status: "confirmado",
      }).eq("id", invite.id);

      return json({ ok: true, email, token_hash: hashed });
    }

    return json({ ok: false, error: "Ação inválida." }, 400);
  } catch (e) {
    await log("error", "unhandled", { message: String((e as Error)?.message ?? e) });
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
