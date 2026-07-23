// One-shot import runner for Loja Integrada staging.
// Accepts row batches via HTTP and writes to *_import tables using service_role.
// Preserves original event timestamps (created_at_source / order_created_at).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("LI_IMPORT_SHARED_SECRET")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.headers.get("x-import-secret") !== SHARED_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
    const body = await req.json();
    const kind = body?.kind as "clientes" | "pedidos";
    const rows = body?.rows;
    if (!kind || !Array.isArray(rows) || rows.length === 0) {
      return json({ error: "invalid_payload" }, 400);
    }

    const table =
      kind === "clientes"
        ? "loja_integrada_clientes_import"
        : "loja_integrada_pedidos_items_import";

    let inserted = 0;
    const CHUNK = 200;
    const errors: unknown[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      let q = sb.from(table).upsert(slice, {
        onConflict: kind === "clientes" ? "id" : undefined,
        ignoreDuplicates: kind === "pedidos",
      });
      const { error, count } = await q;
      if (error) {
        errors.push({ i, message: error.message, details: (error as any).details });
        // fallback: try one-by-one to preserve as many as possible
        for (const r of slice) {
          const single = await sb.from(table).upsert(r, {
            onConflict: kind === "clientes" ? "id" : undefined,
            ignoreDuplicates: kind === "pedidos",
          });
          if (!single.error) inserted += 1;
          else errors.push({ row_key: (r as any).id ?? (r as any).pedido_numero, msg: single.error.message });
        }
      } else {
        inserted += count ?? slice.length;
      }
    }
    return json({ ok: true, kind, received: rows.length, inserted, errors: errors.slice(0, 20) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}