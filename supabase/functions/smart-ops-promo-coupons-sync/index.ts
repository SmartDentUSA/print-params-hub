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
  kind?: string | null;
  free_shipping?: boolean | null;
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
  value ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}` : null;

// Teto de resgates usado como "ilimitado" na Loja Integrada.
const UNLIMITED_QTY = 999999;


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
    const mode = String(body?.mode || "sync");
    if (!tableId && mode !== "categories") {
      return json({ ok: false, error: "promotional_table_id é obrigatório" }, 400);
    }

    const apiKey = (Deno.env.get("LOJA_INTEGRADA_API_KEY") || "").trim();
    const appKey = (Deno.env.get("LOJA_INTEGRADA_APP_KEY") || "").trim() || null;
    if (!apiKey) return json({ ok: false, error: "LOJA_INTEGRADA_API_KEY não configurada" }, 400);

    // Lista as categorias da loja (id, nome e categoria pai) para o seletor do editor.
    if (mode === "categories") {
      const all: Array<{ id: number; nome: string; parent_id: number | null }> = [];
      for (let offset = 0; offset < 500; offset += 100) {
        const parsed = await liRequest(
          `/categoria?limit=100&offset=${offset}&format=json`,
          "GET",
          null,
          apiKey,
          appKey,
        ) as { objects?: Array<Record<string, unknown>>; meta?: { total_count?: number } };
        const objects = parsed?.objects || [];
        for (const cat of objects) {
          const parentUri = typeof cat.categoria_pai === "string" ? cat.categoria_pai : "";
          const parentId = parentUri ? Number(parentUri.split("/").pop()) : null;
          all.push({
            id: Number(cat.id),
            nome: String(cat.nome || ""),
            parent_id: Number.isFinite(parentId as number) ? (parentId as number) : null,
          });
        }
        if (objects.length < 100) break;
      }
      return json({ ok: true, categories: all });
    }

    // Diagnóstico: devolve o cupom exatamente como está gravado na loja.
    if (mode === "inspect") {
      const liId = String(body?.li_coupon_id || "").replace(/\D/g, "");
      if (!liId) return json({ ok: false, error: "li_coupon_id é obrigatório" }, 400);
      const raw = await liRequest(`/cupom/${liId}?format=json`, "GET", null, apiKey, appKey);
      return json({ ok: true, coupon: raw });
    }

    // Diagnóstico: aplica um payload cru num cupom e devolve como a loja gravou.
    if (mode === "probe") {
      const liId = String(body?.li_coupon_id || "").replace(/\D/g, "");
      if (!liId) return json({ ok: false, error: "li_coupon_id é obrigatório" }, 400);
      const put = await liRequest(`/cupom/${liId}`, "PUT", body?.payload ?? {}, apiKey, appKey);
      const raw = await liRequest(`/cupom/${liId}?format=json`, "GET", null, apiKey, appKey);
      return json({ ok: true, put, coupon: raw });
    }


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tableRow } = await supabase
      .from("promotional_tables")
      .select("name,coupon_li_category_ids")
      .eq("id", tableId)
      .maybeSingle();
    const categoryIds = ((tableRow?.coupon_li_category_ids || []) as unknown[])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);

    let query = supabase
      .from("promotional_coupons")
      .select("id,code,discount_type,discount_value,valid_from,valid_until,usage_limit,active,li_coupon_id,kind,free_shipping")
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
      // A Loja Integrada aceita um único tipo por cupom ('porcentagem' | 'fixo' | 'frete_gratis').
      // Os cupons de frete grátis são criados como cumulativos para poderem ser usados
      // junto com o cupom de desconto do mesmo vendedor.
      const isFreight = coupon.free_shipping === true || coupon.kind === "freight";
      const payload: Record<string, unknown> = {
        codigo: coupon.code,
        descricao: `${tableRow?.name || "Promoção Smart Dent"} — ${coupon.code}${isFreight ? " (frete grátis)" : ""}`,
        valor: isFreight ? "0.00" : Number(coupon.discount_value || 0).toFixed(2),
        tipo: isFreight ? "frete_gratis" : isPercent ? "porcentagem" : "fixo",
        ativo: coupon.active,
        aplicar_no_total: true,
        cumulativo: isFreight,
        condicao_cliente: "todos_clientes",
        // Frete grátis e desconto seguem a MESMA regra de produtos (categorias selecionadas).
        condicao_produto: categoryIds.length ? "categorias_selecionadas" : "todos_produtos",
        // A Loja Integrada só persiste as categorias quando os IDs vêm como string.
        categorias: categoryIds.map((id) => String(id)),
        validade: asDateTime(coupon.valid_until, true),
        // USO ILIMITADO até a data final. A Loja Integrada rejeita
        // `quantidade: null` (HTTP 400) e trata `quantidade: 0` como cupom
        // esgotado — por isso usamos um teto altíssimo.
        // `quantidade_por_cliente: 0` = sem limite por cliente.
        quantidade: UNLIMITED_QTY,
        quantidade_por_cliente: 0,

      };


      try {
        const response = coupon.li_coupon_id
          ? await liRequest(`/cupom/${coupon.li_coupon_id}`, "PUT", payload, apiKey, appKey)
          : await liRequest("/cupom", "POST", payload, apiKey, appKey);
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
