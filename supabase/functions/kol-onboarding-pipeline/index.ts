// Pipeline de credenciamento de profissionais (KOL) — acionado pela equipe ou pelo Copilot.
// Etapas: ficha → comissão padrão → contrato (draft) → formulário de indicação (se contrato assinado)
// → cupons → link de acesso. Cada etapa reporta status; falha em uma não esconde as anteriores.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureReferralForm } from "../_shared/kol-referral-form.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Step {
  step: string;
  ok: boolean;
  detail: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    // Staff-only: JWT do usuário + fn_is_internal_staff
    const auth = req.headers.get("authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: userRes } = await admin.auth.getUser(jwt);
    if (!userRes?.user) return json({ error: "unauthorized" }, 401);
    const { data: isStaff } = await admin.rpc("fn_is_internal_staff", { _user_id: userRes.user.id });
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const leadIdIn = String(body?.lead_id ?? "").trim();
    const nome = String(body?.nome ?? "").trim();
    const sellerName = String(body?.seller_name ?? "").trim();
    if (!email && !leadIdIn) return json({ error: "Informe email ou lead_id do profissional." }, 400);

    const steps: Step[] = [];

    // 1) Ficha: localiza ou cria o profissional
    let leadId = leadIdIn;
    if (!leadId) {
      const { data: found } = await admin
        .from("lia_attendances")
        .select("id")
        .ilike("email", email)
        .is("merged_into", null)
        .limit(1)
        .maybeSingle();
      if (found) {
        leadId = found.id;
        steps.push({ step: "ficha", ok: true, detail: "Ficha existente localizada pelo e-mail." });
      } else {
        if (!nome) return json({ error: "Profissional não encontrado. Informe 'nome' para criar a ficha." }, 404);
        const { data: created, error: cErr } = await admin
          .from("lia_attendances")
          .insert({ nome, email, lead_status: "novo", origem_primeiro_contato: "smartops_ficha_profissional" })
          .select("id")
          .single();
        if (cErr || !created) return json({ error: `Falha ao criar ficha: ${cErr?.message}` }, 500);
        leadId = created.id;
        steps.push({ step: "ficha", ok: true, detail: "Ficha criada." });
      }
    } else {
      steps.push({ step: "ficha", ok: true, detail: "Ficha informada pelo lead_id." });
    }

    const { data: lead } = await admin
      .from("lia_attendances")
      .select("id, nome, email, is_kol, prof_kol_commissions, prof_kol_coupons, prof_specialist_team_member_id")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return json({ error: "Ficha não encontrada." }, 404);

    // 2) Vendedor responsável (opcional): fixa na ficha para o formulário e o portal
    if (sellerName) {
      const { data: tm } = await admin
        .from("team_members")
        .select("id, nome_completo")
        .ilike("nome_completo", `%${sellerName}%`)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (tm) {
        await admin.from("lia_attendances").update({ prof_specialist_team_member_id: tm.id }).eq("id", leadId);
        steps.push({ step: "vendedor", ok: true, detail: `Responsável: ${tm.nome_completo}.` });
      } else {
        steps.push({ step: "vendedor", ok: false, detail: `Vendedor "${sellerName}" não encontrado.` });
      }
    }

    // 3) Comissão padrão: o trigger copia o template quando o lead vira KOL;
    //    aqui só garantimos a flag is_kol (o trigger faz a cópia).
    if (!lead.is_kol) {
      const { error: kErr } = await admin.from("lia_attendances").update({ is_kol: true }).eq("id", leadId);
      steps.push(kErr
        ? { step: "comissao", ok: false, detail: `Falha ao marcar KOL: ${kErr.message}` }
        : { step: "comissao", ok: true, detail: "Marcado como KOL; comissão padrão copiada pelo trigger." });
    } else {
      const hasRules = Array.isArray(lead.prof_kol_commissions) && lead.prof_kol_commissions.length > 0;
      steps.push({ step: "comissao", ok: true, detail: hasRules ? "Regras de comissão já presentes." : "Já é KOL; sem regras — verificar template padrão." });
    }

    // 4) Contrato: gera draft se não existir (via kol-contract)
    const { data: contract } = await admin
      .from("kol_contracts")
      .select("id, number, status, signed_at")
      .eq("lead_id", leadId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let contractStatus = contract?.status ?? null;
    if (!contract) {
      const { data: draft, error: dErr } = await admin.functions.invoke("kol-contract", {
        body: { action: "generate_draft", lead_id: leadId },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (dErr || draft?.error) {
        steps.push({ step: "contrato", ok: false, detail: `Falha ao gerar draft: ${dErr?.message ?? draft?.error}` });
      } else {
        contractStatus = "rascunho";
        steps.push({ step: "contrato", ok: true, detail: `Draft do contrato gerado (${draft?.number ?? "sem número"}).` });
      }
    } else {
      steps.push({ step: "contrato", ok: true, detail: `Contrato ${contract.number} — status: ${contract.status}.` });
    }

    // 5) Formulário de indicação: só com contrato assinado (regra do aceite)
    const signed = contractStatus === "assinado" || !!contract?.signed_at;
    if (signed) {
      const form = await ensureReferralForm(admin, leadId);
      steps.push(form
        ? { step: "formulario", ok: true, detail: form.created ? `Formulário criado: ${form.form_name}` : `Formulário já existia: ${form.form_name}` }
        : { step: "formulario", ok: false, detail: "Falha ao criar/localizar o formulário de indicação." });
    } else {
      steps.push({ step: "formulario", ok: true, detail: "Aguardando assinatura do contrato — o formulário de indicação é criado automaticamente no aceite." });
    }

    // 6) Cupons
    const coupons = Array.isArray(lead.prof_kol_coupons) ? lead.prof_kol_coupons.length : 0;
    steps.push({
      step: "cupons",
      ok: true,
      detail: coupons ? `${coupons} cupom(ns) vinculado(s) na ficha.` : "Nenhum cupom vinculado — gerar na ficha do profissional (aba comercial).",
    });

    // 7) Link de acesso ao portal (token único reutilizado)
    const nowIso = new Date().toISOString();
    const { data: tok } = await admin
      .from("professional_portal_tokens")
      .select("token")
      .eq("lead_id", leadId)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let portalToken = tok?.token as string | undefined;
    if (!portalToken) {
      portalToken = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
      await admin.from("professional_portal_tokens").insert({
        token: portalToken,
        lead_id: leadId,
        created_by: "kol_onboarding_pipeline",
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      });
    }
    const base = Deno.env.get("PUBLIC_SITE_URL") || "https://parametros.smartdent.com.br";
    steps.push({ step: "acesso", ok: true, detail: `Portal: ${base}/portal-cursos/${portalToken} (login também por celular em /portal-profissional).` });

    // 8) CRM: deal no funil KOLs (107400) com nota completa (cupons, formulários, comissionamento)
    const { data: crmRes, error: crmErr } = await admin.functions.invoke("kol-crm-sync", {
      body: { lead_id: leadId },
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (crmErr || crmRes?.error || crmRes?.ok === false) {
      steps.push({ step: "crm", ok: false, detail: `Falha no sync CRM: ${crmErr?.message ?? crmRes?.error ?? "etapa com falha"}` });
    } else {
      const dealInfo = crmRes?.deal_id ? ` — deal #${crmRes.deal_id} no funil KOLs` : "";
      steps.push({ step: "crm", ok: true, detail: `CRM sincronizado${dealInfo}.` });
    }

    await admin.rpc("fn_kol_log", {
      _lead_id: leadId,
      _event_type: "kol_onboarding_pipeline_run",
      _entity_type: "kol_pipeline",
      _entity_id: leadId,
      _entity_name: lead.nome,
      _value: null,
      _channel: "kol",
      _data: {
        descricao: `Pipeline de credenciamento executado (${steps.filter((s) => s.ok).length}/${steps.length} etapas ok)`,
        steps,
        actor: userRes.user.email ?? "staff",
        dedupe_key: `kol_pipeline:${leadId}:${Date.now()}`,
      },
    });

    return json({ ok: steps.every((s) => s.ok), lead_id: leadId, nome: lead.nome, steps });
  } catch (e) {
    console.error("[kol-onboarding-pipeline]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
