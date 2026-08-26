import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.awsli.com.br/v1";
const PAGE_SIZE = 100;
const ITEM_BUDGET_PER_RUN = 100;
const WALL_CLOCK_BUDGET_MS = 90000; // 90s — para de processar e salva checkpoint parcial
const PACING_MS = 150; // entre cada repost pro webhook, pra não sobrecarregar

// Auth multi-estratégia — header primeiro, querystring fallback
async function apiFetchLI(path: string, apiKey: string, appKey: string | null): Promise<Response> {
  const headerAuth = `chave_api ${apiKey} aplicacao ${appKey || ""}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: headerAuth, Accept: "application/json" },
  });
  if (res.status !== 401) return res;
  await res.text();
  const qs = new URLSearchParams({ chave_api: apiKey, chave_aplicacao: appKey || "", format: "json" });
  const sep = path.includes("?") ? "&" : "?";
  return await fetch(`${API_BASE}${path}${sep}${qs.toString()}`, { headers: { Accept: "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LI_API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY");
  const LI_APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY");
  const webhookUrl = `${SUPABASE_URL}/functions/v1/smart-ops-ecommerce-webhook`;

  if (!LI_API_KEY) {
    return new Response(JSON.stringify({ error: "LOJA_INTEGRADA_API_KEY não configurada" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: state } = await supabase
    .from("li_reconciliation_state")
    .select("*")
    .eq("id", "pedidos")
    .single();

  const checkpoint = state?.last_data_modificacao ? new Date(state.last_data_modificacao) : new Date(0);

  let processed = 0;
  let errors = 0;
  let stoppedReason = "unknown";
  let offset = 0;

  // A API devolve em ordem decrescente de data_modificacao: o primeiro item é
  // o mais recente. Avançar o checkpoint para uma data mais nova descarta tudo
  // que for mais antigo, então só podemos avançar quando a varredura desceu
  // até o checkpoint anterior sem nenhuma falha.
  let newestSeen: Date | null = null;
  const falhas: string[] = [];

  outer:
  while (true) {
    if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) { stoppedReason = "wall_clock_budget"; break; }

    const res = await apiFetchLI(
      `/pedido/?order_by=-data_modificacao&limit=${PAGE_SIZE}&offset=${offset}&format=json`,
      LI_API_KEY, LI_APP_KEY || null
    );
    if (!res.ok) { errors++; stoppedReason = `api_error_${res.status}`; break; }

    const json = await res.json().catch(() => null);
    const objects: Array<Record<string, unknown>> = json?.objects || [];
    if (objects.length === 0) { stoppedReason = "no_more_data"; break; }

    for (const pedido of objects) {
      const modStr = pedido.data_modificacao as string | undefined;
      const modDate = modStr ? new Date(modStr) : null;

      if (!modDate || modDate <= checkpoint) { stoppedReason = "reached_checkpoint"; break outer; }

      if (!newestSeen || modDate > newestSeen) newestSeen = modDate;

      try {
        const r = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: pedido, origin: "reconciliation_poll" }),
        });
        if (!r.ok) {
          errors++;
          falhas.push(`${pedido.numero ?? pedido.id}:http_${r.status}`);
        }
      } catch (e) {
        errors++;
        falhas.push(`${pedido.numero ?? pedido.id}:${e instanceof Error ? e.name : "erro"}`);
      }

      processed++;
      await new Promise((r) => setTimeout(r, PACING_MS));

      if (processed >= ITEM_BUDGET_PER_RUN) { stoppedReason = "item_budget"; break outer; }
      if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) { stoppedReason = "wall_clock_budget"; break outer; }
    }

    offset += PAGE_SIZE;
    if (!json?.meta?.next) { stoppedReason = "no_more_pages"; break; }
  }

  // O checkpoint só avança quando a varredura foi completa E limpa.
  //
  // Truncada por budget: os pedidos abaixo do ponto de corte ainda não foram
  // vistos; avançar aqui os deixaria para sempre atrás do cursor.
  // Com falha de repost: o pedido que falhou precisa continuar acima do
  // checkpoint para ser retentado na próxima execução.
  //
  // Em ambos os casos mantemos o cursor parado e reprocessamos na próxima
  // rodada — a ingestão é idempotente (dedupe no webhook, itens substituídos
  // por pedido), então repetir é barato e perder não é.
  const varreduraCompleta = ["reached_checkpoint", "no_more_data", "no_more_pages"].includes(stoppedReason);
  const podeAvancar = varreduraCompleta && errors === 0 && newestSeen !== null;
  const newCheckpoint = podeAvancar
    ? newestSeen!.toISOString()
    : state?.last_data_modificacao || null;

  const rodadasBloqueadas = podeAvancar
    ? 0
    : Number(state?.last_run_stats?.blocked_runs ?? 0) + 1;

  if (!podeAvancar && processed > 0) {
    console.warn(
      `[li-reconciler] checkpoint mantido em ${newCheckpoint} — motivo=${stoppedReason} erros=${errors} rodadas_bloqueadas=${rodadasBloqueadas}`,
    );
  }

  await supabase.from("li_reconciliation_state").update({
    last_data_modificacao: newCheckpoint,
    last_run_at: new Date().toISOString(),
    last_run_stats: {
      processed,
      errors,
      stopped_reason: stoppedReason,
      checkpoint_advanced: podeAvancar,
      blocked_runs: rodadasBloqueadas,
      failed_orders: falhas.slice(0, 20),
    },
    updated_at: new Date().toISOString(),
  }).eq("id", "pedidos");

  return new Response(JSON.stringify({
    success: errors === 0,
    processed, errors, stopped_reason: stoppedReason,
    checkpoint_advanced: podeAvancar,
    blocked_runs: rodadasBloqueadas,
    new_checkpoint: newCheckpoint,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});