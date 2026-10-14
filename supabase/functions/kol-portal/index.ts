// kol-portal — lado público do contrato do KOL (acesso pelo token do portal).
// contract: devolve o rascunho para leitura; após o aceite, devolve também comissões e equipamentos.
// accept: aceite eletrônico com 3 caixas (contrato, imagem/voz/nome, LGPD) + hash SHA-256 do texto.
// request_adjust: KOL pede ajuste com uma nota.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/kol-contract-render.ts";
import { acceptKolContract, kolLog, resolveLeadByToken } from "../_shared/kol-accept.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const token = String(body?.token ?? "");
    const leadId = await resolveLeadByToken(admin, token);
    if (!leadId) return json({ error: "invalid_token" }, 401);

    if (action === "contract") {
      const { data: c } = await admin.from("kol_contracts")
        .select("id, number, status, template_version, body_rendered, pending_fields, signed_at, adjust_notes, person_type, legal_name, document, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!c) return json({ ok: true, contract: null });

      const signed = c.status === "assinado";
      let commissions: any[] = [];
      let equipment: any[] = [];
      if (signed) {
        const { data: lead } = await admin.from("lia_attendances").select("prof_kol_commissions").eq("id", leadId).single();
        commissions = Array.isArray(lead?.prof_kol_commissions) ? lead!.prof_kol_commissions : [];
        const { data: loans } = await admin.from("kol_equipment_loans").select("product_name, serial_number, released_at, returned_at, value_brl, status").eq("lead_id", leadId);
        equipment = loans ?? [];
      }
      return json({ ok: true, contract: c, signed, commissions, equipment });
    }

    if (action === "request_adjust") {
      const note = String(body?.note ?? "").trim();
      if (note.length < 5) return json({ error: "Descreva o ajuste desejado." }, 400);
      const { data: c } = await admin.from("kol_contracts").select("id, number, status").eq("lead_id", leadId)
        .in("status", ["enviado", "rascunho"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!c) return json({ error: "Nenhum contrato aguardando aceite" }, 404);
      await admin.from("kol_contracts").update({ status: "ajuste_solicitado", adjust_notes: note, updated_at: new Date().toISOString() }).eq("id", c.id);
      await kolLog(admin, leadId, "kol_contract_adjust_requested", { numero: c.number, nota: note, dedupe_key: `kol_contract_adjust:${c.id}:${Date.now()}` }, c.id, c.number);
      return json({ ok: true });
    }

    if (action === "accept") {
      const r = await acceptKolContract(admin, leadId, req, body?.checks ?? {});
      return json(r.body, r.status);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[kol-portal]", e);
    return json({ error: e?.message ?? "erro interno" }, 500);
  }
});
