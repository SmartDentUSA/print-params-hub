// smart-ops-wa-purge-briefings — v1
// Apaga (para todos) as mensagens de briefing enviadas aos vendedores,
// mantendo o WhatsApp do vendedor limpo. Só roda às 06:00 ou 23:00 (config),
// salvo quando chamado com { force: true } pela UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EVO_BASE, EVO_KEY } from "../_shared/evolution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const force = body?.force === true;

    const { data: cfg } = await supabase
      .from("seller_briefing_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!cfg) return json({ error: "config not found" }, 404);
    if (!force && !cfg.purge_enabled) return json({ skipped: true, reason: "purge_disabled" });

    // Janela horária permitida (America/Sao_Paulo)
    if (!force) {
      const hourSp = Number(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
      if (hourSp !== Number(cfg.purge_hora)) {
        return json({ skipped: true, reason: "fora_da_hora", hour: hourSp, expected: cfg.purge_hora });
      }
    }

    const cutoff = new Date(Date.now() - Number(cfg.purge_idade_horas ?? 24) * 3600 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("message_logs")
      .select("id, whatsapp_number, provider_message_id, evolution_instance")
      .eq("tipo", "briefing_vendedor")
      .eq("status", "enviado")
      .is("purged_at", null)
      .not("provider_message_id", "is", null)
      .lte("created_at", cutoff)
      .limit(400);
    if (error) throw error;

    // Cache de apikeys por instância
    const keyCache = new Map<string, string>();
    const resolveKey = async (instance: string) => {
      if (keyCache.has(instance)) return keyCache.get(instance)!;
      const { data } = await supabase
        .from("team_members")
        .select("evolution_api_key")
        .eq("evolution_instance_name", instance)
        .not("evolution_api_key", "is", null)
        .limit(1)
        .maybeSingle();
      const key = ((data as any)?.evolution_api_key as string | null)?.trim() || EVO_KEY;
      keyCache.set(instance, key);
      return key;
    };

    let deleted = 0;
    let failed = 0;

    for (const row of rows ?? []) {
      const instance = row.evolution_instance || cfg.sender_instance;
      const phone = (row.whatsapp_number || "").replace(/\D/g, "");
      if (!instance || !phone || !row.provider_message_id) { failed++; continue; }
      const apikey = await resolveKey(instance);
      try {
        const url = new URL(`${EVO_BASE}/chat/deleteMessageForEveryone/${encodeURIComponent(instance)}`);
        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: { "Content-Type": "application/json", apikey },
          body: JSON.stringify({
            id: row.provider_message_id,
            remoteJid: `${phone}@s.whatsapp.net`,
            fromMe: true,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) {
          deleted++;
          await supabase.from("message_logs").update({ purged_at: new Date().toISOString() }).eq("id", row.id);
        } else {
          failed++;
          console.warn(`[purge-briefings] delete ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
      } catch (e) {
        failed++;
        console.warn("[purge-briefings] delete error:", e);
      }
    }

    await supabase
      .from("seller_briefing_config")
      .update({ purge_last_run_at: new Date().toISOString() })
      .eq("id", cfg.id);

    return json({ success: true, candidates: (rows ?? []).length, deleted, failed });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
