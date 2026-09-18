// smart-ops-raffle-draw — sorteia um ganhador para um prêmio do sorteio do evento.
// Respeita peso (tickets), exclui quem já ganhou, registra o resultado e avisa
// o ganhador e o grupo de WhatsApp configurados no editor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function render(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
    tpl || "",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raffleId = String(body?.raffle_id || "");
    const prizeId = body?.prize_id ? String(body.prize_id) : null;
    const manualEntryId = body?.entry_id ? String(body.entry_id) : null;
    if (!raffleId) return json({ ok: false, error: "raffle_id_required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: raffle } = await supabase
      .from("event_raffles")
      .select("id, name, prizes, draw_mode, notify_winner, notify_group, wa_instance, wa_group_jid, winner_message_template, group_message_template, event_id")
      .eq("id", raffleId)
      .maybeSingle();
    if (!raffle) return json({ ok: false, error: "raffle_not_found" }, 404);

    const prizes = Array.isArray(raffle.prizes) ? raffle.prizes as any[] : [];
    const prize = prizeId ? prizes.find((p) => String(p.id) === prizeId) : prizes[0];
    const prizeTitle = String(prize?.title || "Prêmio");

    const { data: previous } = await supabase
      .from("event_raffle_draws")
      .select("entry_id, prize_id")
      .eq("raffle_id", raffleId);
    const alreadyWon = new Set((previous || []).map((d: any) => d.entry_id).filter(Boolean));

    const drawnForPrize = (previous || []).filter((d: any) => String(d.prize_id || "") === String(prize?.id || "")).length;
    const quantity = Number(prize?.quantity ?? 1) || 1;
    if (prize && drawnForPrize >= quantity) {
      return json({ ok: false, error: "prize_already_drawn" }, 400);
    }

    const { data: entries } = await supabase
      .from("event_raffle_entries")
      .select("id, name, phone, email, tickets, eligible")
      .eq("raffle_id", raffleId)
      .eq("eligible", true);

    const pool = (entries || []).filter((e: any) => !alreadyWon.has(e.id));
    if (pool.length === 0) return json({ ok: false, error: "no_eligible_entries" }, 400);

    let winner: any;
    if (manualEntryId) {
      winner = pool.find((e: any) => e.id === manualEntryId);
      if (!winner) return json({ ok: false, error: "entry_not_eligible" }, 400);
    } else {
      const weighted: any[] = [];
      for (const e of pool) {
        const t = Math.max(1, Number(e.tickets) || 1);
        for (let i = 0; i < t; i++) weighted.push(e);
      }
      const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      winner = weighted[Math.floor(rand * weighted.length)];
    }

    const { data: draw, error: drawErr } = await supabase
      .from("event_raffle_draws")
      .insert({
        raffle_id: raffleId,
        prize_id: prize?.id ? String(prize.id) : null,
        prize_title: prizeTitle,
        entry_id: winner.id,
        winner_name: winner.name,
        winner_phone: winner.phone,
        winner_email: winner.email,
        participants_count: pool.length,
        seed: manualEntryId ? "manual" : "crypto",
      })
      .select("id")
      .single();
    if (drawErr) return json({ ok: false, error: drawErr.message }, 500);

    const vars = {
      ganhador: String(winner.name || ""),
      premio: prizeTitle,
      sorteio: String(raffle.name || ""),
      participantes: String(pool.length),
    };

    const notify: Record<string, unknown> = {};

    if (raffle.notify_winner && winner.phone) {
      const msg = render(
        raffle.winner_message_template ||
          "Parabéns, {ganhador}! 🎉 Você foi sorteado no {sorteio} e ganhou: {premio}. Nossa equipe já vai falar com você para combinar a entrega.",
        vars,
      );
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-wa-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ phone: winner.phone, message: msg, source: "raffle_winner", metadata: { raffle_id: raffleId, draw_id: draw.id } }),
        });
        notify.winner = await res.json().catch(() => ({}));
      } catch (e) {
        notify.winner_error = String((e as Error)?.message ?? e);
      }
    }

    if (raffle.notify_group && raffle.wa_group_jid) {
      const msg = render(
        raffle.group_message_template ||
          "🎁 Resultado do sorteio *{sorteio}*\nPrêmio: {premio}\nGanhador(a): *{ganhador}*\nParticipantes: {participantes}",
        vars,
      );
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-group-blast`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({
            group_jids: [raffle.wa_group_jid],
            message_type: "msg",
            content: { text: msg },
            campaign_name: `Sorteio — ${raffle.name}`,
            allow_duplicate: true,
          }),
        });
        notify.group = await res.json().catch(() => ({}));
      } catch (e) {
        notify.group_error = String((e as Error)?.message ?? e);
      }
    }

    await supabase
      .from("event_raffle_draws")
      .update({
        notified_at: new Date().toISOString(),
        notify_error: notify.winner_error || notify.group_error ? JSON.stringify(notify) : null,
      })
      .eq("id", draw.id);

    return json({ ok: true, draw_id: draw.id, winner: { id: winner.id, name: winner.name, phone: winner.phone }, participants: pool.length, notify });
  } catch (e) {
    console.error("[raffle-draw] error", String((e as Error)?.message ?? e));
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
