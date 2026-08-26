/**
 * Operação do backfill de itens da Loja Integrada.
 *
 * Escopo: exclusivamente Loja Integrada. Só chama as duas funções SQL da
 * migration `20260826203000_li_order_items_sku_resolution.sql`.
 *
 * Existe para que a carga histórica e a re-resolução sejam disparadas sem
 * acesso ao console SQL, e para que fiquem registradas como uma ação
 * deliberada em vez de um efeito colateral do deploy.
 *
 * Uso:
 *   POST { "acao": "status"   }  — só relata, não escreve (padrão)
 *   POST { "acao": "backfill" }  — normaliza itens_json → order_items
 *   POST { "acao": "resolver" }  — aplica a cadeia de match nos pendentes
 *   POST { "acao": "tudo"     }  — backfill seguido de resolução
 *
 * Autenticação: header `x-import-secret`, o mesmo segredo já usado pelo
 * import-runner da Loja Integrada.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const segredo = Deno.env.get("LI_IMPORT_SHARED_SECRET");
  if (!segredo) return json({ error: "LI_IMPORT_SHARED_SECRET não configurado" }, 500);
  if (req.headers.get("x-import-secret") !== segredo) {
    return json({ error: "não autorizado" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let acao = "status";
  try {
    const body = await req.json();
    if (body?.acao) acao = String(body.acao);
  } catch {
    // Sem corpo: mantém "status", que é a ação que não escreve nada.
  }

  const acoesValidas = ["status", "backfill", "resolver", "tudo"];
  if (!acoesValidas.includes(acao)) {
    return json({ error: `ação inválida: ${acao}`, validas: acoesValidas }, 400);
  }

  const resultado: Record<string, unknown> = { acao };

  try {
    if (acao === "backfill" || acao === "tudo") {
      const { data, error } = await supabase.rpc("fn_li_backfill_order_items");
      if (error) throw new Error(`backfill: ${error.message}`);
      resultado.backfill = Array.isArray(data) ? data[0] : data;
    }

    if (acao === "resolver" || acao === "tudo") {
      const { data, error } = await supabase.rpc("fn_li_resolve_order_items", {
        p_apenas_pendentes: true,
      });
      if (error) throw new Error(`resolver: ${error.message}`);
      resultado.resolucao = Array.isArray(data) ? data[0] : data;
    }

    // Retrato do estado depois da operação (ou apenas o estado, em "status").
    const [itens, pendentes] = await Promise.all([
      supabase.from("loja_integrada_order_items").select("*", { count: "exact", head: true }),
      supabase.from("loja_integrada_order_items")
        .select("*", { count: "exact", head: true })
        .is("matched_by", null),
    ]);

    const total = itens.count ?? 0;
    const semMatch = pendentes.count ?? 0;
    resultado.estado = {
      itens_totais: total,
      resolvidos: total - semMatch,
      pendentes: semMatch,
      cobertura_pct: total > 0 ? Number((100 * (total - semMatch) / total).toFixed(1)) : 0,
    };

    return json(resultado);
  } catch (e) {
    console.error("[li-backfill-items]", e);
    return json({ error: e instanceof Error ? e.message : String(e), acao }, 500);
  }
});
