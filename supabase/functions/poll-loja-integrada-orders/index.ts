import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.awsli.com.br/v1';
const RATE_LIMIT_DELAY = 800;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

interface CircuitBreakerState {
  isOpen: boolean;
  openedAt?: number;
  resetTimeout: number;
  lastResults: boolean[];
}

const circuitState: CircuitBreakerState = {
  isOpen: false,
  resetTimeout: 30000,
  lastResults: [],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY")!;
  const APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  async function apiFetch(endpoint: string) {
    if (circuitState.isOpen) {
      if (circuitState.openedAt && Date.now() > circuitState.openedAt + circuitState.resetTimeout) {
        circuitState.isOpen = false;
        circuitState.lastResults = [];
      } else {
        throw new Error('Circuit breaker aberto');
      }
    }

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
          console.warn(`[poll-li] Rate limit (${strategy.name}) → aguardando ${wait}ms (tentativa ${attempt + 1})`);
          await response.text();
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        break;
      }

      if (attempt === MAX_RETRIES) {
        console.warn(`[poll-li] Max retries com ${strategy.name}`);
        continue;
      }

      if (response?.ok) {
        console.log(`[poll-li] ✅ Auth OK com estratégia: ${strategy.name}`);
        break;
      }

      if (response?.status === 401) {
        console.warn(`[poll-li] 401 com ${strategy.name}, tentando próxima...`);
        await response.text();
        continue;
      }

      break;
    }

    if (!response) throw new Error('Todas as estratégias de auth falharam');

    const success = response!.ok;
    circuitState.lastResults.push(success);
    if (circuitState.lastResults.length > 10) circuitState.lastResults.shift();
    if (circuitState.lastResults.length >= 10 && circuitState.lastResults.filter(r => !r).length > 5) {
      circuitState.isOpen = true;
      circuitState.openedAt = Date.now();
      throw new Error('Circuit breaker aberto: >50% falhas nas últimas 10 reqs');
    }

    if (!success) {
      const errText = await response!.text();
      throw new Error(`API erro ${response!.status}: ${errText}`);
    }

    const text = await response!.text();
    try {
      const data = JSON.parse(text);
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      return data;
    } catch {
      throw new Error(`JSON inválido na resposta: ${text.slice(0, 150)}...`);
    }
  }

  try {
    const { batch_size = 50, offset = 0, full = false, since: sinceOverride } = await req.json();

    let since: string | undefined;
    if (!full) {
      if (sinceOverride) {
        since = sinceOverride;
      } else {
        const { data: last } = await supabase
          .from('lia_attendances')
          .select('lojaintegrada_updated_at')
          .not('lojaintegrada_updated_at', 'is', null)
          .order('lojaintegrada_updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (last?.lojaintegrada_updated_at) since = last.lojaintegrada_updated_at;
      }
    }

    let endpoint = `/pedido/?limit=${batch_size}&offset=${offset}`;
    if (since) endpoint += `&since_atualizado=${encodeURIComponent(since)}`;

    console.log(`[poll-li] Fetching: ${endpoint}`);

    const res = await apiFetch(endpoint);
    const pedidos = res.objects || [];

    const results: Array<{ id: unknown; success: boolean; error?: string }> = [];
    let processed = 0;
    let ignored = 0;

    for (const pedido of pedidos) {
      try {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/smart-ops-ecommerce-webhook`;
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify(pedido),
        });

        const respBody = await resp.text();
        if (!resp.ok) throw new Error(`Webhook ${resp.status}: ${respBody.slice(0, 200)}`);

        processed++;
        results.push({ id: pedido.id || pedido.numero, success: true });
      } catch (e) {
        ignored++;
        results.push({ id: pedido.id || pedido.numero, success: false, error: (e as Error).message });
      }
    }

    console.log(`[poll-li] Done: ${processed} processados, ${ignored} ignorados de ${pedidos.length} pedidos`);

    return new Response(JSON.stringify({
      success: true,
      encontrados: res.meta?.total_count ?? pedidos.length,
      processados: processed,
      ignorados: ignored,
      has_more: !!res.meta?.next,
      next_offset: offset + batch_size,
      since_usado: since || 'full',
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[poll-li] Erro fatal:', err);
    return new Response(JSON.stringify({ success: false, message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
