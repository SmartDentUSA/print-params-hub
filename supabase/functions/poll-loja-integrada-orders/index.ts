import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.awsli.com.br/v1';
const RATE_LIMIT_DELAY = 1000;
const ORDER_DELAY = 300;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const TIMEOUT_MS = 45_000;
const DEFAULT_BATCH = 20;
const DEFAULT_MAX_PAGES = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY")!;
  const APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const startTime = Date.now();

  async function apiFetch(endpoint: string) {
    const strategies = [
      {
        name: 'header',
        url: `${API_BASE}${endpoint}`,
        headers: {
          'Authorization': `chave_api ${API_KEY} aplicacao ${APP_KEY}`,
          'Accept': 'application/json',
        }
      },
      {
        name: 'querystring',
        url: endpoint.includes('?')
          ? `${API_BASE}${endpoint}&chave_api=${encodeURIComponent(API_KEY)}&chave_aplicacao=${encodeURIComponent(APP_KEY)}`
          : `${API_BASE}${endpoint}?chave_api=${encodeURIComponent(API_KEY)}&chave_aplicacao=${encodeURIComponent(APP_KEY)}`,
        headers: { 'Accept': 'application/json' }
      }
    ];

    let response: Response | undefined;

    for (const strategy of strategies) {
      let attempt = 0;
      for (; attempt < MAX_RETRIES; attempt++) {
        response = await fetch(strategy.url, { headers: strategy.headers });
        if (response.status === 429) {
          const wait = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`[poll-li] Rate limit (${strategy.name}) → ${wait}ms (attempt ${attempt + 1})`);
          await response.text();
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        break;
      }
      if (attempt === MAX_RETRIES) { console.warn(`[poll-li] Max retries ${strategy.name}`); continue; }
      if (response?.ok) { console.log(`[poll-li] ✅ Auth OK: ${strategy.name}`); break; }
      if (response?.status === 401) { console.warn(`[poll-li] 401 ${strategy.name}`); await response.text(); continue; }
      break;
    }

    if (!response) throw new Error('Todas as estratégias de auth falharam');
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API erro ${response.status}: ${errText}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`JSON inválido: ${text.slice(0, 150)}`);
    }
  }

  async function resolveCliente(clienteUri: string): Promise<Record<string, unknown> | null> {
    try {
      const match = clienteUri.match(/\/cliente\/(\d+)/);
      if (!match) return null;
      const clienteId = match[1];
      console.log(`[poll-li] Resolving cliente ${clienteId}...`);
      return await apiFetch(`/cliente/${clienteId}/`);
    } catch (err) {
      console.warn(`[poll-li] Failed to resolve cliente from ${clienteUri}:`, (err as Error).message);
      return null;
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || DEFAULT_BATCH, 50);
    const maxPages = Math.min(body.max_pages || DEFAULT_MAX_PAGES, 50);
    const full = body.full === true;
    const sinceOverride = body.since;

    // ── Cursor dedicado via omie_sync_cursors ──
    let since: string | undefined;
    if (!full) {
      if (sinceOverride) {
        since = sinceOverride;
      } else {
        const { data: cursor } = await supabase
          .from('omie_sync_cursors')
          .select('value')
          .eq('key', 'li_poll_since')
          .maybeSingle();
        if (cursor?.value) since = cursor.value;
        // Guard: a stale cursor makes every run reprocess the oldest orders and time out
        // before advancing, so new orders never arrive. Never look back more than 7 days.
        const floor = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 19);
        if (!since || since < floor) since = floor;
      }
    }

    // ── Newest-first pagination ──
    // The API ignores since_atualizado and returns oldest-first, so we read the total
    // count and walk pages backwards from the end, filtering by date locally.
    const head = await apiFetch(`/pedido/?limit=1&offset=0`);
    const totalCount: number = Number(head?.meta?.total_count || 0);
    let offset = typeof body.offset === 'number' ? body.offset : Math.max(totalCount - batchSize, 0);
    let page = 0;
    let totalProcessed = 0;
    let totalIgnored = 0;
    let totalFetched = 0;
    let totalClienteResolved = 0;
    let timedOut = false;
    let maxTimestamp = since || '';
    const sinceCmp = since ? since.replace('T', ' ').slice(0, 19) : '';
    const tsOf = (p: any) => String(p.data_modificacao || p.data_criacao || '').replace('T', ' ').slice(0, 19);
    const allResults: Array<{ id: unknown; success: boolean; error?: string }> = [];

    while (page < maxPages && offset >= 0) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn('[poll-li] ⏱ Timeout guard before page fetch — breaking');
        timedOut = true;
        break;
      }

      const endpoint = `/pedido/?limit=${batchSize}&offset=${offset}`;
      console.log(`[poll-li] Page ${page + 1}/${maxPages} (total=${totalCount}): ${endpoint}`);

      const res = await apiFetch(endpoint);
      const raw = res.objects || [];

      if (!Array.isArray(raw) || raw.length === 0) {
        console.log(`[poll-li] No more orders at offset ${offset}`);
        break;
      }

      // newest first within the page, keep only those changed since cursor
      const sorted = [...raw].sort((a, b) => tsOf(b).localeCompare(tsOf(a)));
      const pedidos = sinceCmp ? sorted.filter((p) => tsOf(p) >= sinceCmp) : sorted;
      const reachedOld = sinceCmp ? sorted.some((p) => tsOf(p) && tsOf(p) < sinceCmp) : false;

      totalFetched += pedidos.length;
      console.log(`[poll-li] Page ${page + 1}: ${raw.length} fetched, ${pedidos.length} recent`);


      for (const pedido of pedidos) {
        // Timeout guard before each order
        if (Date.now() - startTime > TIMEOUT_MS) {
          console.warn('[poll-li] ⏱ Timeout guard mid-page — breaking');
          timedOut = true;
          break;
        }

        try {
          // ── Pre-enrich: resolve cliente URI ──
          if (typeof pedido.cliente === 'string' && /\/cliente\//.test(pedido.cliente)) {
            const clienteData = await resolveCliente(pedido.cliente);
            if (clienteData) {
              pedido.cliente = { ...clienteData, resource_uri: pedido.cliente };
              totalClienteResolved++;
              console.log(`[poll-li] Cliente resolved: email=${clienteData.email || '?'} nome=${clienteData.nome || '?'}`);
            }
            await new Promise(r => setTimeout(r, ORDER_DELAY));
          }

          pedido._enriched_by_poll = true;

          const webhookUrl = `${supabaseUrl}/functions/v1/smart-ops-ecommerce-webhook`;
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify(pedido),
          });

          const respBody = await resp.text();
          if (!resp.ok) throw new Error(`Webhook ${resp.status}: ${respBody.slice(0, 200)}`);

          totalProcessed++;
          allResults.push({ id: pedido.id || pedido.numero, success: true });

          // Track max timestamp from successfully processed orders
          const ts = pedido.data_modificacao || pedido.data_criacao;
          if (ts && ts > maxTimestamp) maxTimestamp = ts;
        } catch (e) {
          totalIgnored++;
          allResults.push({ id: pedido.id || pedido.numero, success: false, error: (e as Error).message });
        }

        await new Promise(r => setTimeout(r, ORDER_DELAY));
      }

      if (timedOut) break;

      if (reachedOld || offset === 0) {
        console.log(`[poll-li] Reached orders older than cursor (or start) — done`);
        break;
      }

      offset = Math.max(offset - batchSize, 0);
      page++;
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }

    // ── Persist cursor ──
    // Only advance the cursor after a complete pass, so a timeout never skips older unprocessed orders.
    if (!timedOut && maxTimestamp && maxTimestamp !== (since || '')) {
      const { error: cursorErr } = await supabase
        .from('omie_sync_cursors')
        .upsert({ key: 'li_poll_since', value: maxTimestamp }, { onConflict: 'key' });
      if (cursorErr) console.error('[poll-li] Cursor save error:', cursorErr.message);
      else console.log(`[poll-li] 📌 Cursor saved: ${maxTimestamp}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[poll-li] Done in ${elapsed}s: ${totalProcessed} processed, ${totalIgnored} ignored, ${totalFetched} fetched, ${totalClienteResolved} clientes resolved, ${page + 1} pages, timedOut=${timedOut}`);

    return new Response(JSON.stringify({
      success: true,
      total_fetched: totalFetched,
      processados: totalProcessed,
      ignorados: totalIgnored,
      clientes_resolved: totalClienteResolved,
      pages_scanned: page + 1,
      max_pages: maxPages,
      since_usado: since || 'full',
      cursor_saved: maxTimestamp || null,
      timed_out: timedOut,
      elapsed_seconds: parseFloat(elapsed),
      results: allResults.slice(0, 100),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[poll-li] Fatal:', err);
    return new Response(JSON.stringify({ success: false, message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
