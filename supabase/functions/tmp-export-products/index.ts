import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (source === "aliases") {
      const { data } = await sb.from("produto_aliases").select("nome_variante,nome_canonico,categoria,subcategoria,sku_interno,ativo");
      return Response.json(data ?? [], { headers: cors });
    }
    if (source === "deal_items") {
      // Aggregate in memory
      const out: any[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await sb.from("deal_items")
          .select("product_name,sku,cod_produto,product_category,product_subcategory,unit_value,deal_date")
          .range(from, from + size - 1);
        if (error) throw error;
        if (!data?.length) break;
        out.push(...data);
        if (data.length < size) break;
        from += size;
      }
      return Response.json(out, { headers: cors });
    }
    if (source === "lead_equip") {
      // Distinct equipment / interest values from lia_attendances
      const cols = [
        "equip_scanner","equip_impressora","equip_cad","software_cad","equip_pos_impressao",
        "equip_fresadora","equip_notebook","insumos_adquiridos","impressora_modelo",
        "sdr_scanner_interesse","sdr_impressora_interesse","sdr_software_cad_interesse",
        "sdr_cursos_interesse","sdr_insumos_lab_interesse","sdr_pos_impressao_interesse",
        "sdr_solucoes_interesse","sdr_dentistica_interesse","sdr_caracterizacao_interesse",
        "sdr_fresagem_interesse","sdr_scanner_modelo","sdr_resina_atual","sdr_cura_modelo",
        "sdr_fresadora_marca","sdr_fresadora_modelo",
      ];
      const counts: Record<string, Record<string, number>> = {};
      for (const c of cols) counts[c] = {};
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await sb.from("lia_attendances")
          .select(cols.join(",") as any)
          .is("merged_into", null)
          .range(from, from + size - 1);
        if (error) throw error;
        if (!data?.length) break;
        for (const row of data as any[]) {
          for (const c of cols) {
            const v = row[c];
            if (v === null || v === undefined || v === "") continue;
            const list = Array.isArray(v) ? v.map(String) : [String(v)];
            for (const x of list) {
              counts[c][x] = (counts[c][x] || 0) + 1;
            }
          }
        }
        if (data.length < size) break;
        from += size;
      }
      const out: any[] = [];
      for (const c of cols) {
        for (const [val, n] of Object.entries(counts[c])) out.push({ column: c, value: val, leads: n });
      }
      return Response.json(out, { headers: cors });
    }
    return Response.json({ error: "unknown source" }, { status: 400, headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});