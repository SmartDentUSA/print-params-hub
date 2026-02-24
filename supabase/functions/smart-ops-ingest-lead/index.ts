import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = "55" + digits;
  if (digits.length < 12 || digits.length > 13) return null;
  return "+" + digits;
}

function extractField(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(payload)) {
      if (k.toLowerCase().includes(key.toLowerCase()) && v) {
        return String(v).trim();
      }
    }
  }
  return null;
}

function detectProductFromFormName(formName: string | null): string | null {
  if (!formName) return null;
  const upper = formName.toUpperCase();
  if (upper.includes("VITALITY")) return "Vitality";
  if (upper.includes("EDGEMINI") || upper.includes("EDGE MINI")) return "EdgeMini";
  if (upper.includes("IOCONNECT") || upper.includes("IO CONNECT")) return "IoConnect";
  if (upper.includes("EBOOK") || upper.includes("PLACA")) return "Ebook/Placa";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const payload = await req.json();

    console.log("[ingest-lead] Payload recebido:", JSON.stringify(payload).slice(0, 500));

    const formName = payload.form_name || payload.formName || payload.form || null;

    // Extract fields with flexible mapping
    const nome = extractField(payload, "full_name", "name", "nome") ||
      [extractField(payload, "first_name", "first name"), extractField(payload, "last_name", "last name")]
        .filter(Boolean).join(" ") || "Sem nome";

    const email = extractField(payload, "email") || "";
    if (!email) {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefoneRaw = extractField(payload, "phone_number", "phone", "mobile", "telefone", "celular");
    const telefoneNormalized = normalizePhone(telefoneRaw);

    const areaAtuacao = extractField(payload, "area de atuacao", "area_atuacao", "specialty");
    const especialidade = extractField(payload, "especialidade", "specialty");
    const comoDigitaliza = extractField(payload, "como digitaliza", "como_digitaliza", "moldagens");
    const temImpressora = extractField(payload, "impressoes 3d", "tem_impressora", "utiliza impressoes");
    const impressoraModelo = extractField(payload, "impressora_modelo", "modelo impressora", "printer_model");
    const resinaInteresse = extractField(payload, "resina_interesse", "resina", "resin");
    const produtoInteresse = detectProductFromFormName(formName) || extractField(payload, "produto_interesse", "product");

    const source = payload.source || formName || "webhook";

    // Upsert lead
    const leadData = {
      nome, email, telefone_raw: telefoneRaw, telefone_normalized: telefoneNormalized,
      area_atuacao: areaAtuacao, especialidade, como_digitaliza: comoDigitaliza,
      tem_impressora: temImpressora, impressora_modelo: impressoraModelo,
      resina_interesse: resinaInteresse, produto_interesse: produtoInteresse,
      source, form_name: formName, raw_payload: payload,
      origem_campanha: payload.campaign || null,
      utm_source: payload.utm_source || null, utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null, utm_term: payload.utm_term || null,
      ip_origem: payload.ip || req.headers.get("x-forwarded-for") || null,
      lead_status: "novo",
    };

    const { data: lead, error: upsertError } = await supabase
      .from("lia_attendances")
      .upsert(leadData, { onConflict: "email" })
      .select("id, piperun_id")
      .single();

    if (upsertError) {
      console.error("[ingest-lead] Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ingest-lead] Lead salvo:", lead.id);

    // Create Piperun deal if not already linked
    let piperunId = lead.piperun_id;
    if (!piperunId && PIPERUN_API_KEY) {
      try {
        const piperunRes = await fetch("https://api.pipe.run/v1/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Token": PIPERUN_API_KEY },
          body: JSON.stringify({
            title: `${nome} - ${produtoInteresse || source}`,
            person: { name: nome, email, phone: telefoneNormalized || telefoneRaw },
          }),
        });
        const piperunData = await piperunRes.json();
        if (piperunData?.data?.id) {
          piperunId = String(piperunData.data.id);
          await supabase
            .from("lia_attendances")
            .update({ piperun_id: piperunId })
            .eq("id", lead.id);
          console.log("[ingest-lead] Piperun deal criado:", piperunId);
        } else {
          console.warn("[ingest-lead] Piperun response sem ID:", JSON.stringify(piperunData).slice(0, 300));
        }
      } catch (pipeErr) {
        console.error("[ingest-lead] Piperun API error:", pipeErr);
      }
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id, piperun_id: piperunId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ingest-lead] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
