/**
 * smart-ops-promo-coupons-sync
 * Cria/atualiza na Loja Integrada os cupons de desconto gerados a partir de
 * uma tabela promocional (um cupom por vendedor autorizado).
 *
 * POST { promotional_table_id: uuid, coupon_ids?: uuid[] }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LI_BASE = "https://api.awsli.com.br/v1";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  active: boolean;
  li_coupon_id: string | null;
};

function authVariants(apiKey: string, appKey: string | null) {
  return [
    {
      name: "header-combined",
      headers: {
        Authorization: appKey
          ? `chave_api ${apiKey} aplicacao ${appKey}`
          : `chave_api ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      } as Record<string, string>,
      query: "",
    },
    {
      name: "querystring",
      headers: { "Content-Type": "application/json", Accept: "application/json" } as Record<string, string>,
      query: appKey
        ? `?chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey)}`
        : `?chave_api=${encodeURIComponent(apiKey)}`,
    },
  ];
}

/** Envia a requisição tentando as duas formas de autenticação da Loja Integrada. */
async function liRequest(
  path: string,
  method: "GET" | "POST" | "PUT",
  body: unknown,
  apiKey: string,
  appKey: string | null,
) {
  let lastError = "";
  for (const variant of authVariants(apiKey, appKey)) {
    const sep = path.includes("?") && variant.query ? variant.query.replace("?", "&") : variant.query;
    const response = await fetch(`${LI_BASE}${path}${sep}`, {
      method,
      headers: variant.headers,
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) {
      try { return JSON.parse(text); } catch { return {}; }
    }
    lastError = `HTTP ${response.status} (${variant.name}) ${text.slice(0, 300)}`;
    // 401/403 => tenta a próxima estratégia; outros erros são do payload
    if (response.status !== 401 && response.status !== 403) break;
  }
  throw new Error(lastError || "Falha desconhecida na Loja Integrada");
}

const asDateTime = (value: string | null, endOfDay = false) =>
  value ? `${value} ${endOfDay ? "23:59:59" : "00:00:00"}` : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const tableId = String(body?.promotional_table_id || "").trim();
    if (!tableId) return json({ ok: false, error: "promotional_table_id é obrigatório" }, 400);

    const apiKey = (Deno.env.get("LOJA_INTEGRADA_API_KEY") || "").trim();
    const appKey = (Deno.env.get("LOJA_INTEGRADA_APP_KEY") || "").trim() || null;
    if (!apiKey) return json({ ok: false, error: "LOJA_INTEGRADA_API_KEY não configurada" }, 400);

    if (body?.mode === "inspect") {
      const cats = await liRequest("/categoria/?limit=200", "GET", null, apiKey, appKey).catch((e) => ({ error: String(e) }));
      const cupons = await liRequest("/cupom_desconto/?limit=2", "GET", null, apiKey, appKey).catch((e) => ({ error: String(e) }));
      return json({ ok: true, cats, cupons });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
      .from("promotional_coupons")
      .select("id,code,discount_type,discount_value,valid_from,valid_until,usage_limit,active,li_coupon_id")
      .eq("promotional_table_id", tableId);
    if (Array.isArray(body?.coupon_ids) && body.coupon_ids.length) {
      query = query.in("id", body.coupon_ids as string[]);
    }
    const { data, error } = await query;
    if (error) return json({ ok: false, error: error.message }, 500);

    const coupons = (data || []) as Coupon[];
    if (!coupons.length) return json({ ok: false, error: "Nenhum cupom para enviar." }, 400);

    const results: Array<{ code: string; ok: boolean; error?: string }> = [];

    for (const coupon of coupons) {
      const isPercent = coupon.discount_type !== "fixed";
      const payload: Record<string, unknown> = {
        codigo: coupon.code,
        descricao: `Promoção Smart Dent — ${coupon.code}`,
        valor: Number(coupon.discount_value || 0),
        tipo: isPercent ? "porcentagem" : "fixo",
        ativo: coupon.active,
        validade_inicio: asDateTime(coupon.valid_from),
        validade_fim: asDateTime(coupon.valid_until, true),
      };
      if (coupon.usage_limit && coupon.usage_limit > 0) payload.quantidade = coupon.usage_limit;

      try {
        const response = coupon.li_coupon_id
          ? await liRequest(`/cupom_desconto/${coupon.li_coupon_id}/`, "PUT", payload, apiKey, appKey)
          : await liRequest("/cupom_desconto/", "POST", payload, apiKey, appKey);
        const liId = String(
          (response as Record<string, unknown>)?.id ??
          (response as Record<string, unknown>)?.cupom ??
          coupon.li_coupon_id ?? "",
        ).replace(/\D/g, "") || coupon.li_coupon_id;

        await supabase.from("promotional_coupons").update({
          li_coupon_id: liId,
          li_synced_at: new Date().toISOString(),
          li_sync_error: null,
        }).eq("id", coupon.id);
        results.push({ code: coupon.code, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase.from("promotional_coupons").update({
          li_sync_error: message.slice(0, 500),
        }).eq("id", coupon.id);
        results.push({ code: coupon.code, ok: false, error: message });
      }
    }

    const sent = results.filter((row) => row.ok).length;
    return json({ ok: sent > 0, sent, failed: results.length - sent, results });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
