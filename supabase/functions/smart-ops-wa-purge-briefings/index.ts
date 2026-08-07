// smart-ops-wa-purge-briefings — v1
// Apaga (para todos) as mensagens de briefing enviadas aos vendedores,
// mantendo o WhatsApp do vendedor limpo. Roda na hora configurada na UI
// (qualquer hora, fuso São Paulo), salvo quando chamado com { force: true }.

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

    const cutoffMs = Date.now() - Number(cfg.purge_idade_horas ?? 24) * 3600 * 1000;
    const cutoff = new Date(cutoffMs).toISOString();

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

    const deleteMsg = async (instance: string, apikey: string, id: string, remoteJid: string) => {
      const url = new URL(`${EVO_BASE}/chat/deleteMessageForEveryone/${encodeURIComponent(instance)}`);
      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", apikey },
        body: JSON.stringify({ id, remoteJid, fromMe: true }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) console.warn(`[purge-briefings] delete ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res.ok;
    };

    for (const row of rows ?? []) {
      const instance = row.evolution_instance || cfg.sender_instance;
      const phone = (row.whatsapp_number || "").replace(/\D/g, "");
      if (!instance || !phone || !row.provider_message_id) { failed++; continue; }
      const apikey = await resolveKey(instance);
      try {
        const ok = await deleteMsg(instance, apikey, row.provider_message_id, `${phone}@s.whatsapp.net`);
        if (ok) {
          deleted++;
          await supabase.from("message_logs").update({ purged_at: new Date().toISOString() }).eq("id", row.id);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        console.warn("[purge-briefings] delete error:", e);
      }
    }

    // ── Fallback: varredura do chat (logs antigos sem provider_message_id) ──
    // Busca as mensagens enviadas por nós no chat de cada vendedor e apaga
    // as que são briefing ("Resumo do Lead").
    const debug: any[] = [];
    let scanned = 0;
    let deletedScan = 0;
    const senderInstance = (cfg.sender_instance as string | null) || null;
    if (senderInstance) {
      const apikey = await resolveKey(senderInstance);
      const { data: phoneRows } = await supabase
        .from("message_logs")
        .select("whatsapp_number")
        .eq("tipo", "briefing_vendedor")
        .not("whatsapp_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      const phones = Array.from(
        new Set((phoneRows ?? []).map((r: any) => String(r.whatsapp_number || "").replace(/\D/g, "")).filter((p) => p.length >= 10)),
      );

      const isBriefing = (text: string) =>
        /an[áa]lise smartops/i.test(text) ||
        /resumo do lead/i.test(text) ||
        /🧾/.test(text) ||
        /app\.pipe\.run\/#\/deals\//i.test(text) ||
        (/hist[óo]rico:/i.test(text) && /oportunidade:/i.test(text));

      for (const phone of phones) {
        const remoteJid = `${phone}@s.whatsapp.net`;
        try {
          const res = await fetch(`${EVO_BASE}/chat/findMessages/${encodeURIComponent(senderInstance)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey },
            body: JSON.stringify({ where: { key: { remoteJid } }, limit: 200 }),
            signal: AbortSignal.timeout(25_000),
          });
          if (!res.ok) {
            debug.push({ phone, status: res.status });
            console.warn(`[purge-briefings] findMessages ${res.status}: ${(await res.text()).slice(0, 200)}`);
            continue;
          }
          const payload = await res.json();
          const records: any[] = payload?.messages?.records ?? payload?.records ?? (Array.isArray(payload) ? payload : []);
          debug.push({
            phone,
            records: records.length,
            total: payload?.messages?.total,
            pages: payload?.messages?.pages,
            sample: records[0] ? JSON.stringify(records[0]).slice(0, 900) : null,
          });
          for (const m of records) {
            const key = m?.key ?? {};
            if (!key?.fromMe || !key?.id) continue;
            const rawTs = Number(m?.messageTimestamp ?? 0);
            const ts = rawTs > 1e12 ? rawTs : rawTs * 1000;
            if (ts && ts > cutoffMs) continue;
            const text =
              m?.message?.conversation ??
              m?.message?.extendedTextMessage?.text ??
              m?.message?.imageMessage?.caption ??
              m?.message?.documentMessage?.caption ??
              "";
            if (!text || !isBriefing(String(text))) continue;
            scanned++;
            try {
              if (await deleteMsg(senderInstance, apikey, key.id, key.remoteJid || remoteJid)) deletedScan++;
              else failed++;
            } catch (e) {
              failed++;
              console.warn("[purge-briefings] scan delete error:", e);
            }
          }
        } catch (e) {
          console.warn("[purge-briefings] findMessages error:", e);
        }
      }
    }

    await supabase
      .from("seller_briefing_config")
      .update({ purge_last_run_at: new Date().toISOString() })
      .eq("id", cfg.id);

    return json({
      success: true,
      candidates: (rows ?? []).length,
      deleted: deleted + deletedScan,
      deleted_by_log: deleted,
      deleted_by_scan: deletedScan,
      scan_matches: scanned,
      failed,
      debug: body?.debug === true ? debug : undefined,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
