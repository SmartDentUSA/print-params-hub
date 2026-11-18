// Traz da Zernio o status de cada contato das campanhas de WhatsApp Oficial (enviado, entregue,
// lido, recusado pela Meta) para campaign_send_log, que alimenta a timeline do lead e os filtros
// de público. Só lê a Zernio e grava status; não envia nada. Roda pela rotina automática.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dueBroadcasts, toRecipientRows } from "./map.ts";

const ZERNIO = "https://zernio.com/api/v1";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOCK_KEY = "zernio_wa_recipient_sync";

Deno.serve(async () => {
  const key = Deno.env.get("ZERNIO_API_KEY");
  if (!key) return json({ ok: false, error: "ZERNIO_API_KEY não configurada" }, 500);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // No máximo uma leitura a cada 10 min, para não gastar a cota da Zernio usada pelos envios.
  const { data: st } = await admin.from("cron_state").select("updated_at").eq("key", LOCK_KEY).maybeSingle();
  if (st?.updated_at && Date.now() - new Date(st.updated_at).getTime() < 10 * 60_000) {
    return json({ ok: true, skipped: "recent" });
  }
  await admin.from("cron_state").upsert({ key: LOCK_KEY, value: "running", updated_at: new Date().toISOString() });

  const z = async (path: string) => {
    for (let i = 0; ; i++) {
      const r = await fetch(`${ZERNIO}${path}`, { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 429 && i < 4) { await sleep(((Number(r.headers.get("retry-after")) || 10) + 1) * 1000); continue; }
      if (!r.ok) throw new Error(`Zernio ${path} ${r.status}`);
      const remaining = Number(r.headers.get("x-ratelimit-remaining"));
      if (Number.isFinite(remaining) && remaining < 100) await sleep(5000);
      return await r.json();
    }
  };

  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const { data: sessions } = await admin.from("campaign_sessions")
    .select("id, results").eq("channel", "whatsapp_oficial").gte("created_at", since);
  let broadcasts = 0, updated = 0;
  const errors: string[] = [];
  for (const s of sessions ?? []) {
    const r = s.results ?? {};
    const all: string[] = r.broadcast_ids ?? (r.broadcast_id ? [r.broadcast_id] : []);
    for (const bid of dueBroadcasts(r.slots, all, new Date())) {
      try {
        let recipients: unknown[] = [];
        // Cada envio tem até 200 contatos (uma página); páginas extras só por segurança.
        for (let skip = 0; skip < 2000; skip += 200) {
          const page = await z(`/broadcasts/${bid}/recipients?limit=200&skip=${skip}`);
          recipients = recipients.concat(page.recipients ?? []);
          if (!page.pagination?.hasMore) break;
        }
        const rows = toRecipientRows(recipients as any[]);
        broadcasts++;
        if (!rows.length) continue;
        const { data: n, error } = await admin.rpc("fn_wa_official_apply_recipients", { p_session: s.id, p_broadcast: bid, p_rows: rows });
        if (error) throw error;
        updated += Number(n) || 0;
      } catch (e) {
        errors.push(`${bid}: ${(e as Error).message}`.slice(0, 200));
      }
    }
  }
  await admin.from("cron_state").upsert({ key: LOCK_KEY, value: "done", updated_at: new Date().toISOString(), meta: { broadcasts, updated, errors: errors.slice(0, 5) } });
  return json({ ok: errors.length === 0, broadcasts, updated, errors: errors.slice(0, 5) });
});
