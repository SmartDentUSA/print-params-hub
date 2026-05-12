import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data: automations, error } = await supabase
        .from("lia_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const enriched = await Promise.all(
        (automations ?? []).map(async (a: any) => {
          let enviadasHoje = 0;
          let enviadasTotal = 0;
          let cliques = 0;

          if (a.function_name) {
            const [{ count: hoje }, { count: total }] = await Promise.all([
              supabase
                .from("system_health_logs")
                .select("id", { count: "exact", head: true })
                .eq("function_name", a.function_name)
                .gte("created_at", startOfDay.toISOString()),
              supabase
                .from("system_health_logs")
                .select("id", { count: "exact", head: true })
                .eq("function_name", a.function_name),
            ]);
            enviadasHoje = hoje ?? 0;
            enviadasTotal = total ?? 0;
          }

          if (a.short_link_tag) {
            const { data: links } = await supabase
              .from("short_links")
              .select("click_count")
              .ilike("produto", `%${a.short_link_tag}%`);
            cliques = (links ?? []).reduce((s: number, l: any) => s + (l.click_count ?? 0), 0);
          }

          const taxa = enviadasTotal > 0 ? (cliques / enviadasTotal) * 100 : 0;
          return { ...a, metrics: { enviadasHoje, enviadasTotal, cliques, taxa } };
        }),
      );

      return json({ automations: enriched });
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const body = await req.json();
      const { id, ...rest } = body ?? {};
      if (!id) return json({ error: "id required" }, 400);

      const allowed = [
        "ativo",
        "nome",
        "subtitulo",
        "mensagem_horario_comercial",
        "mensagem_fora_horario",
        "horario_inicio",
        "horario_fim",
        "trigger_tags",
        "canal",
      ];
      const update: Record<string, unknown> = {};
      for (const k of allowed) if (k in rest) update[k] = rest[k];

      const { data, error } = await supabase
        .from("lia_automations")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json({ automation: data });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});