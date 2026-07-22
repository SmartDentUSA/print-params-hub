// Round-robin Gmail email dispatcher.
// Runs every minute via pg_cron. Enforces:
//  - global 499/day cap (America/Sao_Paulo)
//  - send window 07:30–19:00 (America/Sao_Paulo)
//  - 1 email per active campaign per tick (fair rotation)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_CAP = 499;
const WINDOW_START_MIN = 7 * 60 + 30;  // 07:30
const WINDOW_END_MIN   = 19 * 60;      // 19:00

function nowSaoPauloMinutes(): number {
  // Get HH:MM in America/Sao_Paulo without pulling in a tz lib
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cur = nowSaoPauloMinutes();
    if (cur < WINDOW_START_MIN || cur >= WINDOW_END_MIN) {
      return new Response(JSON.stringify({ ok: true, skipped: "outside_window", now_min: cur }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Today's Gmail sent count (America/Sao_Paulo day)
    const { data: statusJson } = await supabase.rpc("fn_email_queue_status");
    const sentToday = Number((statusJson as any)?.sent_today ?? 0);
    const remaining = Math.max(0, DAILY_CAP - sentToday);
    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "cap_reached", sent_today: sentToday }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Active campaigns: scheduled/sending, due, with queued rows
    const nowIso = new Date().toISOString();
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, status, scheduled_at, started_at")
      .in("status", ["scheduled", "sending"])
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("scheduled_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    const activeIds = (camps || []).map((c: any) => c.id);
    if (!activeIds.length) {
      return new Response(JSON.stringify({ ok: true, active: 0, sent_this_tick: 0, remaining }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For each active campaign pick the oldest queued row
    const picks: Array<{ campaign_id: string; send_log_id: string }> = [];
    for (const cid of activeIds) {
      if (picks.length >= remaining) break;
      const { data: nextLog } = await supabase
        .from("campaign_send_log")
        .select("id")
        .eq("source_campaign_id", cid)
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextLog?.id) picks.push({ campaign_id: cid, send_log_id: nextLog.id });
    }

    const projectRef = (Deno.env.get("SUPABASE_URL") || "").match(/https?:\/\/([^.]+)/)?.[1] || "";
    const funcUrl = `https://${projectRef}.supabase.co/functions/v1/smart-ops-send-gmail`;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let sent = 0, failed = 0;
    const usedCampaigns = new Set<string>();
    for (const p of picks) {
      // Ensure campaign is marked 'sending' on first send
      if (!usedCampaigns.has(p.campaign_id)) {
        usedCampaigns.add(p.campaign_id);
        await supabase.from("campaigns")
          .update({ status: "sending", started_at: nowIso })
          .eq("id", p.campaign_id)
          .eq("status", "scheduled");
      }
      try {
        const r = await fetch(funcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${svcKey}`,
            "apikey": svcKey,
          },
          body: JSON.stringify({ action: "send_one", send_log_id: p.send_log_id }),
        });
        if (r.ok) sent++; else failed++;
      } catch (e) {
        console.error("[email-tick] send_one failed", e);
        failed++;
      }
    }

    // Mark completed campaigns whose queue emptied
    for (const cid of usedCampaigns) {
      const { count } = await supabase
        .from("campaign_send_log")
        .select("id", { count: "exact", head: true })
        .eq("source_campaign_id", cid)
        .eq("status", "queued");
      if ((count ?? 0) === 0) {
        await supabase.from("campaigns")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", cid);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      window: "07:30-19:00",
      sent_today_before: sentToday,
      remaining_before: remaining,
      active_campaigns: activeIds.length,
      sent_this_tick: sent, failed_this_tick: failed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[email-tick] fatal", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});