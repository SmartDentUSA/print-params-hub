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

    if (req.method === "POST") {
      const body = await req.json();
      const nome = String(body?.nome ?? "").trim();
      if (!nome) return json({ error: "nome required" }, 400);

      const slugBase = String(body?.slug ?? nome)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const slug = `${slugBase || "automacao"}-${Date.now().toString(36)}`;

      const insert = {
        slug,
        nome,
        subtitulo: body?.subtitulo ?? null,
        icone: body?.icone ?? "message-square",
        cor: body?.cor ?? "blue",
        canal: body?.canal ?? "whatsapp",
        trigger_event: body?.trigger_event ?? null,
        trigger_tags: Array.isArray(body?.trigger_tags) ? body.trigger_tags : [],
        horario_inicio: body?.horario_inicio ?? "08:00",
        horario_fim: body?.horario_fim ?? "18:00",
        evolution_instance_name: body?.evolution_instance_name ?? null,
        mensagem_horario_comercial: body?.mensagem_horario_comercial ?? null,
        mensagem_fora_horario: body?.mensagem_fora_horario ?? null,
        ativo: body?.ativo ?? false,
      };

      const { data, error } = await supabase
        .from("lia_automations")
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return json({ automation: data });
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
        "evolution_instance_name",
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