/**
 * Corrige a data dos eventos de e-commerce já gravados na timeline do lead.
 *
 * Escopo: exclusivamente Loja Integrada. Só toca em linhas de
 * `lead_activity_log` com `source_channel = 'ecommerce'` (e, opcionalmente,
 * em `lead_cart_history` dos mesmos pedidos).
 *
 * Por que precisa ir à API: o banco guarda, por pedido, apenas `data_criacao`
 * e a última `data_modificacao`. A data de cada fato — quando foi pago,
 * quando foi enviado — só existe na Loja Integrada. Esta função rebusca o
 * pedido e recalcula o `event_timestamp` de cada evento com a mesma regra
 * que o webhook passou a usar (`_shared/li-event-date.ts`).
 *
 * Uso:
 *   POST { "acao": "inspecionar" }  — padrão, NÃO escreve. Relata quais
 *                                     campos de data a API devolve e o que
 *                                     mudaria em cada evento.
 *   POST { "acao": "corrigir" }     — aplica as correções.
 *
 * Parâmetros opcionais: { "limite_pedidos": 50, "pedido": "2748" }
 * Autenticação: header `x-import-secret`.
 *
 * Rode "inspecionar" primeiro: é ele que mostra de qual campo cada data veio,
 * antes de qualquer escrita.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveLiEventDate } from "../_shared/li-event-date.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-secret",
};

const API_BASE = "https://api.awsli.com.br/v1";
const ORCAMENTO_MS = 100_000;
const PACING_MS = 120;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Auth dual: header primeiro, querystring só se der 401 (mesmo padrão do
// reconciler e do sync de clientes).
async function apiFetchLI(
  path: string,
  apiKey: string,
  appKey: string | null,
): Promise<Record<string, unknown> | null> {
  const headerAuth = `chave_api ${apiKey} aplicacao ${appKey ?? ""}`;
  let res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: headerAuth, Accept: "application/json" },
  });
  if (res.status === 401) {
    await res.text();
    const qs = new URLSearchParams({
      chave_api: apiKey,
      chave_aplicacao: appKey ?? "",
      format: "json",
    });
    const sep = path.includes("?") ? "&" : "?";
    res = await fetch(`${API_BASE}${path}${sep}${qs}`, { headers: { Accept: "application/json" } });
  }
  if (!res.ok) {
    await res.text().catch(() => "");
    return null;
  }
  return await res.json().catch(() => null);
}

/** Lista as chaves que parecem data em envios/pagamentos, para o relatório. */
function camposDeDataObservados(order: Record<string, unknown>): string[] {
  const achados = new Set<string>();
  for (const k of Object.keys(order)) {
    if (/data|date/i.test(k) && order[k]) achados.add(k);
  }
  for (const grupo of ["envios", "pagamentos"]) {
    const lista = order[grupo];
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      if (!item || typeof item !== "object") continue;
      for (const k of Object.keys(item as Record<string, unknown>)) {
        if (/data|date/i.test(k) && (item as Record<string, unknown>)[k]) {
          achados.add(`${grupo}.${k}`);
        }
      }
    }
  }
  return [...achados].sort();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const iniciadoEm = Date.now();
  const segredo = Deno.env.get("LI_IMPORT_SHARED_SECRET");
  if (!segredo) return json({ error: "LI_IMPORT_SHARED_SECRET não configurado" }, 500);
  if (req.headers.get("x-import-secret") !== segredo) return json({ error: "não autorizado" }, 401);

  const LI_API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY");
  const LI_APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY");
  if (!LI_API_KEY) return json({ error: "LOJA_INTEGRADA_API_KEY não configurada" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let acao = "inspecionar";
  let limitePedidos = 50;
  let pedidoAlvo: string | null = null;
  try {
    const body = await req.json();
    if (body?.acao) acao = String(body.acao);
    if (body?.limite_pedidos) limitePedidos = Math.min(Number(body.limite_pedidos) || 50, 500);
    if (body?.pedido) pedidoAlvo = String(body.pedido);
  } catch {
    // Sem corpo: mantém "inspecionar", que não escreve.
  }

  if (!["inspecionar", "corrigir"].includes(acao)) {
    return json({ error: `ação inválida: ${acao}`, validas: ["inspecionar", "corrigir"] }, 400);
  }
  const escrever = acao === "corrigir";

  // Eventos de e-commerce agrupados por pedido.
  let q = supabase
    .from("lead_activity_log")
    .select("id, entity_id, event_type, event_timestamp, created_at, event_data")
    .eq("source_channel", "ecommerce")
    .not("entity_id", "is", null)
    .order("entity_id", { ascending: true })
    .limit(5000);
  if (pedidoAlvo) q = q.eq("entity_id", pedidoAlvo);

  const { data: eventos, error: erroEventos } = await q;
  if (erroEventos) return json({ error: erroEventos.message }, 500);

  const porPedido = new Map<string, typeof eventos>();
  for (const ev of eventos ?? []) {
    const k = String(ev.entity_id);
    if (!porPedido.has(k)) porPedido.set(k, []);
    porPedido.get(k)!.push(ev);
  }

  const pedidos = [...porPedido.keys()].slice(0, limitePedidos);
  const camposVistos = new Set<string>();
  const mudancas: Array<Record<string, unknown>> = [];
  let pedidosLidos = 0;
  let pedidosNaoEncontrados = 0;
  let eventosAtualizados = 0;
  let semDataConfiavel = 0;
  let interrompidoPorTempo = false;

  for (const numero of pedidos) {
    if (Date.now() - iniciadoEm > ORCAMENTO_MS) { interrompidoPorTempo = true; break; }

    const order = await apiFetchLI(`/pedido/${encodeURIComponent(numero)}/?format=json`, LI_API_KEY, LI_APP_KEY ?? null);
    await new Promise((r) => setTimeout(r, PACING_MS));

    if (!order) { pedidosNaoEncontrados++; continue; }
    pedidosLidos++;
    for (const c of camposDeDataObservados(order)) camposVistos.add(c);

    for (const ev of porPedido.get(numero) ?? []) {
      const tipo = String(ev.event_type).replace(/^ecommerce_/, "");
      const novo = resolveLiEventDate(order, tipo);
      if (!novo.confiavel) { semDataConfiavel++; continue; }

      const antigo = ev.event_timestamp ? new Date(ev.event_timestamp).toISOString() : null;
      if (antigo === novo.iso) continue;

      mudancas.push({
        pedido: numero,
        evento: tipo,
        de: antigo,
        para: novo.iso,
        fonte: novo.fonte,
      });

      if (escrever) {
        const eventData = (ev.event_data && typeof ev.event_data === "object")
          ? { ...ev.event_data as Record<string, unknown> }
          : {};
        eventData.data_fonte = novo.fonte;
        eventData.data_corrigida_de = antigo;

        const { error: erroUpd } = await supabase
          .from("lead_activity_log")
          .update({ event_timestamp: novo.iso, event_data: eventData })
          .eq("id", ev.id);
        if (erroUpd) {
          console.warn(`[li-fix-dates] pedido=${numero} evento=${tipo}: ${erroUpd.message}`);
        } else {
          eventosAtualizados++;
        }
      }
    }
  }

  return json({
    acao,
    escreveu: escrever,
    pedidos_na_fila: porPedido.size,
    pedidos_processados: pedidos.length,
    pedidos_lidos_da_api: pedidosLidos,
    pedidos_nao_encontrados: pedidosNaoEncontrados,
    eventos_com_data_divergente: mudancas.length,
    eventos_atualizados: eventosAtualizados,
    eventos_sem_data_confiavel: semDataConfiavel,
    interrompido_por_tempo: interrompidoPorTempo,
    // O achado mais útil da inspeção: quais campos de data a loja realmente
    // devolve nesta conta. Confirma se a data de envio/pagamento existe.
    campos_de_data_na_api: [...camposVistos].sort(),
    amostra_de_mudancas: mudancas.slice(0, 40),
  });
});
