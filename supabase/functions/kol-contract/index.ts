import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---------- Mini renderizador Handlebars-like ----------
// Suporta: {{path}}, {{#if path}}, {{#if a == "b"}}, {{else}}, {{/if}}, {{#each path}}, {{/each}}
type Ctx = Record<string, unknown>;

function lookup(ctx: Ctx, path: string): unknown {
  if (path === "." || path === "this") return ctx["."];
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Ctx)[p];
  }
  return cur;
}

function evalCond(ctx: Ctx, expr: string): boolean {
  const eq = expr.match(/^(.+?)\s*==\s*"([^"]*)"$/);
  if (eq) return String(lookup(ctx, eq[1].trim()) ?? "") === eq[2];
  const v = lookup(ctx, expr.trim());
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function render(tpl: string, ctx: Ctx): string {
  let out = "";
  let i = 0;
  while (i < tpl.length) {
    const open = tpl.indexOf("{{", i);
    if (open === -1) { out += tpl.slice(i); break; }
    out += tpl.slice(i, open);
    const close = tpl.indexOf("}}", open);
    if (close === -1) { out += tpl.slice(open); break; }
    const tag = tpl.slice(open + 2, close).trim();
    i = close + 2;

    if (tag.startsWith("#if ")) {
      const { truthy, falsy, next } = extractBlock(tpl, i, "if");
      out += evalCond(ctx, tag.slice(4)) ? render(truthy, ctx) : render(falsy, ctx);
      i = next;
    } else if (tag.startsWith("#each ")) {
      const { truthy, next } = extractBlock(tpl, i, "each");
      const arr = lookup(ctx, tag.slice(6).trim());
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const child: Ctx = typeof item === "object" && item !== null
            ? { ...ctx, ...(item as Ctx), ".": item }
            : { ...ctx, ".": item };
          out += render(truthy, child);
        }
      }
      i = next;
    } else if (tag.startsWith("/") || tag === "else") {
      // fechamento solto — ignora (o extractBlock consome os pares)
    } else {
      const v = lookup(ctx, tag);
      out += v == null ? "" : String(v);
    }
  }
  return out;
}

// Extrai o bloco até o fechamento correspondente, separando {{else}}
function extractBlock(tpl: string, start: number, kind: string): { truthy: string; falsy: string; next: number } {
  let depth = 1;
  let i = start;
  let elsePos = -1;
  while (i < tpl.length) {
    const open = tpl.indexOf("{{", i);
    if (open === -1) break;
    const close = tpl.indexOf("}}", open);
    if (close === -1) break;
    const tag = tpl.slice(open + 2, close).trim();
    if (tag.startsWith(`#${kind}`)) depth++;
    else if (tag === `/${kind}`) {
      depth--;
      if (depth === 0) {
        const block = tpl.slice(start, open);
        if (elsePos >= 0) {
          return { truthy: tpl.slice(start, elsePos), falsy: tpl.slice(elsePos, open), next: close + 2 };
        }
        return { truthy: block, falsy: "", next: close + 2 };
      }
    } else if (tag === "else" && depth === 1 && elsePos === -1) {
      elsePos = open;
      // guarda posição do else; o truthy termina aqui
      const rest = extractBlock(tpl, close + 2, kind);
      return { truthy: tpl.slice(start, open), falsy: rest.truthy, next: rest.next };
    }
    i = close + 2;
  }
  return { truthy: tpl.slice(start), falsy: "", next: tpl.length };
}

// ---------- Helpers ----------
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function fmtPhone(lead: Record<string, unknown>): string {
  const raw = (lead.telefone_raw as string) || (lead.telefone_normalized as string) || "";
  const d = digits(raw);
  if (d.length >= 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}`;
  }
  return raw || "—";
}

function enderecoCompleto(lead: Record<string, unknown>): string {
  const parts = [
    [lead.prof_street, lead.prof_number].filter(Boolean).join(", "),
    lead.prof_complement,
    lead.prof_neighborhood,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(" - ") : "—";
}

const extenso: Record<number, string> = {
  1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis",
  8: "oito", 10: "dez", 15: "quinze", 30: "trinta", 90: "noventa",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Usuário autenticado
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Apenas admin ou suporte
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: { role: string }) => ["admin", "support_agent"].includes(r.role));
    if (!allowed) return json({ error: "Sem permissão" }, 403);

    const body = await req.json();
    const { action } = body as { action: string };

    // ---------- LIST ----------
    if (action === "list") {
      const { data, error } = await admin.from("kol_contracts")
        .select("id, number, status, pending_fields, body_rendered, created_at, sent_at, signed_at, wa_group_id, wa_group_error, adjust_notes")
        .eq("lead_id", body.lead_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ contracts: data ?? [] });
    }

    // ---------- GENERATE ----------
    if (action === "generate") {
      const leadId = body.lead_id as string;
      const { data: lead, error: leadErr } = await admin.from("lia_attendances")
        .select("id, nome, email, telefone_raw, telefone_normalized, pessoa_cpf, empresa_cnpj, empresa_razao_social, prof_cro, prof_cep, prof_city, prof_street, prof_number, prof_complement, prof_neighborhood, prof_kol_commissions, prof_kol_coupons, prof_kol_form_ids")
        .eq("id", leadId).single();
      if (leadErr || !lead) return json({ error: "Lead não encontrado" }, 404);

      const { data: tpl } = await admin.from("kol_contract_templates")
        .select("version, body_md").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!tpl) return json({ error: "Nenhum modelo de contrato ativo" }, 400);

      const personType = (body.person_type as string) || "PF";
      const legalName = (body.legal_name as string) || (lead.nome as string) || "";
      const document = (body.document as string) || "";
      const pixKey = (body.pix_key as string) || "";
      const repName = (body.rep_name as string) || "";
      const repCpf = (body.rep_cpf as string) || "";

      // Número sequencial do contrato
      const { count } = await admin.from("kol_contracts").select("id", { count: "exact", head: true });
      const number = `KOL-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      // Vendedor
      let vendedor: Ctx | null = null;
      if (body.seller_team_member_id) {
        const { data: tm } = await admin.from("team_members")
          .select("nome_completo, evolution_phone").eq("id", body.seller_team_member_id).maybeSingle();
        if (tm) vendedor = { nome: tm.nome_completo ?? "—", celular: tm.evolution_phone ?? "" };
      }

      // Comissões do cadastro do profissional
      const commissions = Array.isArray(lead.prof_kol_commissions) ? lead.prof_kol_commissions as Record<string, unknown>[] : [];
      const regras = commissions
        .filter((c) => c && c.percent != null && (c.product_name || c.category))
        .map((c) => ({
          produto_ou_categoria: String(c.product_name || c.category || ""),
          subcategoria: c.subcategory ? String(c.subcategory) : "—",
          percent: String(c.percent),
          active_from: c.active_from ? String(c.active_from) : "assinatura",
        }));

      // Cupons do KOL
      const couponCodes: string[] = Array.isArray(lead.prof_kol_coupons)
        ? (lead.prof_kol_coupons as unknown[]).map((c) => String(c)).filter(Boolean)
        : (lead.prof_kol_coupon ? [String(lead.prof_kol_coupon)] : []);
      let cupons: Ctx[] = [];
      if (couponCodes.length) {
        const { data: promos } = await admin.from("platform_promotions")
          .select("code, discount_type, discount_value, valid_from, valid_until").in("code", couponCodes);
        cupons = (promos ?? []).map((p: Record<string, unknown>) => ({
          code: p.code,
          beneficio: p.discount_type === "percent" ? `${p.discount_value}% de desconto` : `R$ ${p.discount_value} de desconto`,
          commission_percent: "",
          valid_from: p.valid_from ? String(p.valid_from).slice(0, 10) : "—",
          valid_until: p.valid_until ? String(p.valid_until).slice(0, 10) : "sem fim",
        }));
      }

      // Formulários de indicação vinculados
      const formIds: string[] = Array.isArray(lead.prof_kol_form_ids) ? (lead.prof_kol_form_ids as string[]) : [];
      let formularios: Ctx[] = [];
      if (formIds.length) {
        const { data: forms } = await admin.from("smartops_forms").select("name, slug").in("id", formIds);
        formularios = (forms ?? []).map((f: Record<string, unknown>) => ({
          name: f.name,
          url: `https://admin.smartdent.com.br/f/${f.slug}`,
        }));
      }

      // Equipamentos em comodato
      const { data: loans } = await admin.from("kol_equipment_loans")
        .select("product_name, serial_number, value_brl, released_at, status").eq("lead_id", leadId).eq("status", "emprestado");
      const equipamentos = (loans ?? []).map((l: Record<string, unknown>, idx: number) => ({
        n: idx + 1,
        produto_nome: l.product_name ?? "",
        produto_sku: "",
        serial_number: l.serial_number ?? "—",
        value_brl: l.value_brl != null ? Number(l.value_brl).toFixed(2) : "—",
        released_at: l.released_at ?? "—",
        return_due_at: "sob demanda",
        condicao_entrega: "em uso",
        returned_at: "",
        condicao_devolucao: "",
      }));
      const totalValue = (loans ?? []).reduce((s: number, l: Record<string, unknown>) => s + (Number(l.value_brl) || 0), 0);

      // Pendências
      const pending: string[] = [];
      if (!document.trim()) pending.push(personType === "PF" ? "CPF" : "CNPJ");
      if (!pixKey.trim()) pending.push("chave PIX");
      if (personType !== "PF" && (!repName.trim() || !repCpf.trim())) pending.push("representante legal");
      if (!regras.length) pending.push("tabela de comissão");
      if (!vendedor) pending.push("vendedor responsável");

      const conteudoMin = 4;
      const descontoPct = 10;
      const ctx: Ctx = {
        PF: personType === "PF",
        PJ: personType !== "PF",
        contrato: {
          numero: number,
          versao_modelo: tpl.version,
          janela_atribuicao_dias: 90,
          conteudo_minimo_mes: conteudoMin,
          conteudo_minimo_mes_extenso: extenso[conteudoMin] ?? String(conteudoMin),
          conteudo_formatos: "posts no feed, stories, reels ou vídeos",
          conteudo_dias_no_ar: 30,
          desconto_insumos_pct: descontoPct,
          desconto_insumos_pct_extenso: extenso[descontoPct] ?? String(descontoPct),
          eventos_remuneracao_texto: "A participação em eventos como palestrante ou apoio de estande não é remunerada por padrão, salvo ajuste específico por escrito entre as partes para cada evento.",
          comodato_aluguel_pena_pct_mes: 1,
          periodo_inatividade_dias: 90,
          meses_sem_conteudo: 2,
          data_aceite: "a preencher no aceite eletrônico",
        },
        kol: {
          tipo_pessoa: personType,
          nome: lead.nome ?? legalName,
          nome_legal: legalName,
          razao_social: personType !== "PF" ? legalName : (lead.empresa_razao_social ?? ""),
          documento: document,
          documento_pessoa_fisica: (lead.pessoa_cpf as string) || (personType === "PF" ? document : repCpf) || "—",
          cro: (lead.prof_cro as string) || "—",
          endereco_completo: enderecoCompleto(lead),
          cidade: (lead.prof_city as string) || "—",
          cep: (lead.prof_cep as string) || "—",
          email: (lead.email as string) || "—",
          celular_formatado: fmtPhone(lead),
          dados_pagamento_resumo: pixKey ? `Chave PIX: ${pixKey}` : "a informar",
          representante_nome: repName || "—",
          representante_cpf: repCpf || "—",
        },
        marca: { perfil_instagram: "@smartdent.oficial" },
        vendedor: vendedor ?? { nome: "a definir", celular: "" },
        grupo: null,
        comissao: { regras, aceita_em: "—", versao: "1" },
        cupons,
        formularios,
        link_indicacao: "",
        equipamentos,
        "equipamentos.total_value": undefined,
        aceite: { data_hora: "a preencher no aceite", ip: "—", aparelho: "—", hash: "—" },
        imagem: { registros_anteriores: "—", prazo_retirada_dias: 30 },
      };

      // total_value é resolvido antes do render (path sobre array não é alcançável pelo lookup)
      const tplBody = tpl.body_md.replace(/\{\{equipamentos\.total_value\}\}/g, totalValue.toFixed(2));
      const bodyRendered = render(tplBody, ctx);

      const { data: inserted, error: insErr } = await admin.from("kol_contracts").insert({
        lead_id: leadId,
        number,
        status: "rascunho",
        template_version: tpl.version,
        body_rendered: bodyRendered,
        person_type: personType,
        legal_name: legalName,
        document,
        pix_key: pixKey,
        rep_name: repName || null,
        rep_cpf: repCpf || null,
        seller_team_member_id: body.seller_team_member_id || null,
        wa_instance_name: body.wa_instance_name || null,
        wa_group_members: body.wa_group_members ?? [],
        pending_fields: pending,
        commission_snapshot: regras,
        created_by: user.id,
      }).select("id, number").single();
      if (insErr) throw insErr;

      await admin.from("kol_contracts").update({ updated_at: new Date().toISOString() }).eq("id", inserted.id);
      return json({ id: inserted.id, number: inserted.number, pending_fields: pending });
    }

    // ---------- SEND ----------
    if (action === "send") {
      const { data: c, error } = await admin.from("kol_contracts")
        .select("id, status, lead_id, number").eq("id", body.contract_id).single();
      if (error || !c) return json({ error: "Contrato não encontrado" }, 404);
      if (!["rascunho", "ajuste_solicitado"].includes(c.status)) {
        return json({ error: `Contrato em status "${c.status}" não pode ser enviado` }, 400);
      }
      const { error: upErr } = await admin.from("kol_contracts")
        .update({ status: "enviado", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", c.id);
      if (upErr) throw upErr;
      return json({ ok: true, whatsapp_sent: false, send_error: "Envio por WhatsApp automático ainda não configurado — compartilhe o link do portal com o profissional." });
    }

    // ---------- REVOKE ----------
    if (action === "revoke") {
      const { error: upErr } = await admin.from("kol_contracts")
        .update({
          status: "revogado",
          revoked_at: new Date().toISOString(),
          adjust_notes: body.reason ? `Revogado: ${body.reason}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.contract_id);
      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
