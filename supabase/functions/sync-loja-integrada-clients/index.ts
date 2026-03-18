import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.awsli.com.br/v1';
const RATE_LIMIT_DELAY = 800;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("LOJA_INTEGRADA_API_KEY")!;
  const APP_KEY = Deno.env.get("LOJA_INTEGRADA_APP_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Multi-strategy auth fetch (same as poll-loja-integrada-orders) ──
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
          console.warn(`[sync-li-clients] Rate limit (${strategy.name}) → ${wait}ms (attempt ${attempt + 1})`);
          await response.text();
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        break;
      }
      if (attempt === MAX_RETRIES) { console.warn(`[sync-li-clients] Max retries ${strategy.name}`); continue; }
      if (response?.ok) { console.log(`[sync-li-clients] ✅ Auth OK: ${strategy.name}`); break; }
      if (response?.status === 401) { console.warn(`[sync-li-clients] 401 ${strategy.name}`); await response.text(); continue; }
      break;
    }

    if (!response) throw new Error('Todas as estratégias de auth falharam');
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API erro ${response.status}: ${errText}`);
    }
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      return data;
    } catch {
      throw new Error(`JSON inválido: ${text.slice(0, 150)}`);
    }
  }

  // ── Normalize phone ──
  function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, "");
    if (!digits || digits.length < 8) return null;
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
    if (digits.length === 10) {
      const ddd = parseInt(digits.slice(0, 2));
      if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
    }
    if (digits.length < 10 || digits.length > 11) return null;
    return `+55${digits}`;
  }

  // ── Enrich with order history ──
  async function enrichWithOrders(leadId: string, clienteId: number) {
    try {
      const ordersRes = await apiFetch(`/pedido/?cliente_id=${clienteId}&limit=100`);
    const pedidosRaw = ordersRes?.objects || [];

      // ── Filtrar apenas pedidos que realmente pertencem a este cliente ──
      // O endpoint /pedido/?cliente_id=X NÃO filtra — retorna os primeiros pedidos da loja inteira.
      // O campo "cliente" é uma URI string "/api/v1/cliente/{id}" ou um objeto com { id }.
      const pedidosReais = pedidosRaw.filter((p: any) => {
        const clienteRef = p.cliente;
        if (!clienteRef) return false;
        if (typeof clienteRef === 'string') {
          return clienteRef.includes(`/cliente/${clienteId}`);
        }
        if (typeof clienteRef === 'object') {
          return clienteRef.id === clienteId || String(clienteRef.id) === String(clienteId);
        }
        return false;
      });
      console.log(`[sync-li-clients] Pedidos API: ${pedidosRaw.length}, reais do cliente ${clienteId}: ${pedidosReais.length}`);

      if (pedidosReais.length === 0) return { orders_found: pedidosRaw.length, real_orders: 0 };

      // ── Substituir completamente o histórico (purga pedidos fantasmas antigos) ──
      const newOrders = pedidosReais
        .map((p: any) => ({
          numero: p.numero,
          id: p.id,
          data_criacao: p.data_criacao,
          data_modificacao: p.data_modificacao,
          valor_total: p.valor_total,
          valor_subtotal: p.valor_subtotal,
          valor_envio: p.valor_envio,
          valor_desconto: p.valor_desconto,
          peso_real: p.peso_real,
          utm_campaign: p.utm_campaign,
          situacao_codigo: p.situacao?.codigo || null,
          situacao_nome: p.situacao?.nome || null,
          situacao_aprovado: p.situacao?.aprovado || false,
          situacao_cancelado: p.situacao?.cancelado || false,
        }));

      if (newOrders.length === 0) return { orders_found: pedidos.length, new_orders: 0 };

      const mergedHistory = [...existingHistory, ...newOrders];

      // Calc LTV from approved orders
      const approvedOrders = mergedHistory.filter((o: any) => o.situacao_aprovado && !o.situacao_cancelado);
      const ltvTotal = approvedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.valor_total || '0'), 0);
      const lastOrderDate = mergedHistory
        .map((o: any) => o.data_criacao)
        .filter(Boolean)
        .sort()
        .pop() || null;

      await supabase
        .from('lia_attendances')
        .update({
          lojaintegrada_historico_pedidos: mergedHistory,
          lojaintegrada_total_pedidos: mergedHistory.length,
          lojaintegrada_pedidos_aprovados: approvedOrders.length,
          ltv_total: ltvTotal > 0 ? ltvTotal : undefined,
          lojaintegrada_ultimo_pedido: lastOrderDate,
          lojaintegrada_updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      return { orders_found: pedidos.length, new_orders: newOrders.length };
    } catch (e) {
      console.warn(`[sync-li-clients] Order enrichment failed for lead ${leadId}: ${e}`);
      return { orders_found: 0, error: (e as Error).message };
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 50, 50);
    const maxPages = Math.min(body.max_pages || 10, 50);
    const enrichOrders = body.enrich_orders !== false; // default true

    let offset = 0;
    let page = 0;
    let totalSynced = 0;
    let totalSkipped = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: { email: string; error: string }[] = [];

    console.log(`[sync-li-clients] Starting (batchSize=${batchSize}, maxPages=${maxPages}, enrichOrders=${enrichOrders})`);

    while (page < maxPages) {
      const endpoint = `/cliente/?limit=${batchSize}&offset=${offset}`;
      console.log(`[sync-li-clients] Fetching: ${endpoint}`);

      const res = await apiFetch(endpoint);
      const clients = res?.objects || [];
      if (!Array.isArray(clients) || clients.length === 0) {
        console.log(`[sync-li-clients] No more clients at offset ${offset}`);
        break;
      }

      console.log(`[sync-li-clients] Page ${page + 1}: ${clients.length} clients`);

      for (const client of clients) {
        const email = (client.email || "").trim().toLowerCase();

        // Skip filters
        if (!email || !email.includes("@")) { totalSkipped++; continue; }
        if (email.includes("@lojaintegrada.com.br")) { totalSkipped++; continue; }
        if (client.nome === "Cliente anonimizado" || client.nome === "Alterado pela LGPD") { totalSkipped++; continue; }
        if (client.cpf === "99999999999") { totalSkipped++; continue; }

        try {
          const upsertFields: Record<string, unknown> = {
            nome: client.nome || "Cliente LI",
            email,
            pessoa_cpf: client.cpf || null,
            empresa_cnpj: client.cnpj || null,
            empresa_razao_social: client.razao_social || null,
            lojaintegrada_sexo: client.sexo || null,
            lojaintegrada_data_nascimento: client.data_nascimento || null,
            lojaintegrada_tipo_pessoa: client.tipo || null,
            lojaintegrada_cliente_id: client.id,
            lojaintegrada_cliente_data_criacao: client.data_criacao || null,
            lojaintegrada_updated_at: new Date().toISOString(),
          };

          // Check existing by email
          const { data: existing } = await supabase
            .from('lia_attendances')
            .select('id')
            .eq('email', email)
            .limit(1)
            .maybeSingle();

          let leadId: string;

          if (existing) {
            const { error: updateErr } = await supabase
              .from('lia_attendances')
              .update(upsertFields)
              .eq('id', existing.id);
            if (updateErr) throw updateErr;
            leadId = existing.id;
            totalUpdated++;
          } else {
            const phone = normalizePhone(client.telefone || null);
            const { data: inserted, error: insertErr } = await supabase
              .from('lia_attendances')
              .insert({
                ...upsertFields,
                source: 'loja_integrada',
                telefone_normalized: phone,
                lead_status: 'cliente_ecommerce',
              })
              .select('id')
              .single();

            if (insertErr) {
              // Handle unique constraint (email already exists from concurrent insert)
              if (insertErr.code === '23505') {
                const { data: retry } = await supabase
                  .from('lia_attendances')
                  .select('id')
                  .eq('email', email)
                  .limit(1)
                  .maybeSingle();
                if (retry) {
                  await supabase.from('lia_attendances').update(upsertFields).eq('id', retry.id);
                  leadId = retry.id;
                  totalUpdated++;
                } else {
                  throw insertErr;
                }
              } else {
                throw insertErr;
              }
            } else {
              leadId = inserted.id;
              totalCreated++;
            }
          }

          // Enrich with orders
          if (enrichOrders && leadId!) {
            await enrichWithOrders(leadId!, client.id);
          }

          totalSynced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ email, error: msg });
        }
      }

      if (clients.length < batchSize) break;
      offset += batchSize;
      page++;
    }

    console.log(`[sync-li-clients] Done: synced=${totalSynced}, created=${totalCreated}, updated=${totalUpdated}, skipped=${totalSkipped}, errors=${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      total_synced: totalSynced,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[sync-li-clients] Fatal:', err);
    return new Response(JSON.stringify({ success: false, message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
