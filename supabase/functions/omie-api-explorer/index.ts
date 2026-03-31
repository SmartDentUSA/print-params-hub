import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OMIE_BASE = "https://app.omie.com.br/api/v1";

async function omieCall(endpoint: string, call: string, params: Record<string, unknown> = {}) {
  const appKey = Deno.env.get("OMIE_APP_KEY");
  const appSecret = Deno.env.get("OMIE_APP_SECRET");
  if (!appKey || !appSecret) throw new Error("OMIE_APP_KEY ou OMIE_APP_SECRET não configurados");

  const body = {
    call,
    app_key: appKey,
    app_secret: appSecret,
    param: [{ pagina: 1, registros_por_pagina: 5, ...params }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${OMIE_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, error: String(e) };
  }
}

const ENDPOINTS: Record<string, { endpoint: string; call: string; label: string }> = {
  clientes: { endpoint: "/geral/clientes/", call: "ListarClientes", label: "Clientes" },
  clientes_resumido: { endpoint: "/geral/clientes/", call: "ListarClientesResumido", label: "Clientes (resumido)" },
  pedidos: { endpoint: "/produtos/pedido/", call: "ListarPedidos", label: "Pedidos de Venda" },
  contas_receber: { endpoint: "/financas/contareceber/", call: "ListarContasReceber", label: "Contas a Receber" },
  estoque: { endpoint: "/estoque/consulta/", call: "ListarPosEstoque", label: "Posição de Estoque" },
  produtos: { endpoint: "/geral/produtos/", call: "ListarProdutos", label: "Produtos" },
  nfes: { endpoint: "/produtos/nfconsultar/", call: "ListarNF", label: "Notas Fiscais" },
  ordens_servico: { endpoint: "/servicos/os/", call: "ListarOrdemServico", label: "Ordens de Serviço" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const only = url.searchParams.get("only");
    const keys = only
      ? only.split(",").map((k) => k.trim()).filter((k) => k in ENDPOINTS)
      : Object.keys(ENDPOINTS);

    if (keys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum endpoint válido", available: Object.keys(ENDPOINTS) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown> = {};

    for (const key of keys) {
      const ep = ENDPOINTS[key];
      console.log(`[omie-explorer] Chamando ${ep.label} (${ep.call})...`);
      const result = await omieCall(ep.endpoint, ep.call);

      if (result.ok) {
        const data = result.data;
        // Extrair campos disponíveis do primeiro registro
        const allKeys = Object.keys(data);
        // Tentar encontrar a lista de registros (geralmente é o campo que é um array)
        let records: unknown[] = [];
        let totalKey = "";
        let recordsKey = "";

        for (const k of allKeys) {
          if (Array.isArray(data[k])) {
            records = data[k];
            recordsKey = k;
          }
          if (typeof data[k] === "number" && k.toLowerCase().includes("total")) {
            totalKey = k;
          }
        }

        const fields = records.length > 0 && typeof records[0] === "object" && records[0] !== null
          ? Object.keys(records[0] as Record<string, unknown>)
          : [];

        results[key] = {
          label: ep.label,
          status: "ok",
          total_registros: totalKey ? data[totalKey] : records.length,
          records_key: recordsKey,
          total_key: totalKey,
          fields_available: fields,
          field_count: fields.length,
          sample_count: records.length,
          sample_data: records.slice(0, 3),
          raw_keys: allKeys,
        };
      } else {
        results[key] = {
          label: ep.label,
          status: "error",
          error: result.error,
        };
      }
    }

    return new Response(JSON.stringify({ ts: new Date().toISOString(), results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
