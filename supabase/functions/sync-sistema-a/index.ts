import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// pg_cron schedule — configure via Supabase SQL Editor:
//
//   SELECT cron.schedule(
//     'sync-sistema-a-every-4h',
//     '0 */4 * * *',
//     $$
//       SELECT net.http_post(
//         url := current_setting('app.supabase_url') || '/functions/v1/sync-sistema-a',
//         headers := jsonb_build_object(
//           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//           'Content-Type', 'application/json'
//         ),
//         body := '{}'::jsonb
//       );
//     $$
//   );

const SISTEMA_A_KB_URL = 'https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando sincronizacao do catalogo de produtos do Sistema A...');

    // Fetch product catalog from Sistema A Knowledge Base API
    const kbResponse = await fetch(`${SISTEMA_A_KB_URL}?format=system_b`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!kbResponse.ok) {
      throw new Error(`Knowledge Base API retornou status ${kbResponse.status}: ${await kbResponse.text()}`);
    }

    const kbData = await kbResponse.json();

    // Accept either an array directly or { products: [...] }
    const products: Record<string, unknown>[] = Array.isArray(kbData)
      ? kbData
      : (kbData.products ?? []);

    if (!products.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum produto retornado pelo Sistema A', upserted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Recebidos ${products.length} produtos do Sistema A`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Map incoming products to products_catalog schema and upsert
    const rows = products.map((p) => ({
      product_id:               String(p.product_id ?? p.id ?? ''),
      name:                     (p.name as string) ?? null,
      category:                 (p.category as string) ?? null,
      subcategory:              (p.subcategory as string) ?? null,
      workflow_stages:          (p.workflow_stages as object) ?? null,
      whatsapp_sequences:       (p.whatsapp_sequences as object) ?? null,
      whatsapp_messages:        (p.whatsapp_messages as object) ?? null,
      forbidden_products:       (p.forbidden_products as object) ?? null,
      required_products:        (p.required_products as object) ?? null,
      anti_hallucination_rules: (p.anti_hallucination_rules as object) ?? null,
      clinical_brain_status:    (p.clinical_brain_status as string) ?? null,
      synced_at:                now,
    })).filter((r) => r.product_id);

    const { error: upsertError } = await supabase
      .from('products_catalog')
      .upsert(rows, { onConflict: 'product_id', ignoreDuplicates: false });

    if (upsertError) {
      console.error('Erro ao fazer upsert em products_catalog:', upsertError);
      throw upsertError;
    }

    console.log(`${rows.length} produtos sincronizados com sucesso`);

    return new Response(
      JSON.stringify({ success: true, message: 'Catalogo sincronizado com sucesso', upserted: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro na sincronizacao:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido', success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
