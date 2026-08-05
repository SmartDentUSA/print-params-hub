// deno-lint-ignore-file no-explicit-any
// Função TEMPORÁRIA de teste: dispara a notificação de pagamento Stripe.
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyExecutivesOfPayment, type PaymentNotice } from "../_shared/stripe-notify.ts";
import { EVO_BASE, EVO_KEY } from "../_shared/evolution.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const INSTANCE = Deno.env.get("NOTIFY_SELLER_INSTANCE") ?? "smartdent_marketing";

Deno.serve(async (req) => {
  const { data: tm } = await supabase
    .from("team_members")
    .select("evolution_api_key")
    .eq("evolution_instance_name", INSTANCE)
    .not("evolution_api_key", "is", null)
    .limit(1)
    .maybeSingle();
  const key = ((tm as any)?.evolution_api_key as string | null)?.trim() || EVO_KEY;
  let state: unknown = null;
  try {
    const r = await fetch(`${EVO_BASE}/instance/connectionState/${encodeURIComponent(INSTANCE)}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15_000),
    });
    state = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) {
    state = { error: (e as Error).message };
  }
  if (new URL(req.url).searchParams.get("state_only") === "1") {
    return new Response(JSON.stringify({ instance: INSTANCE, state }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const notice: PaymentNotice = {
    kind: "ativacao",
    customerName: "TESTE — Disparo Interno Smart Dent",
    customerEmail: "teste@smartdent.com.br",
    customerPhone: "+55 16 99732-2333",
    amount: 1199,
    currency: "brl",
    internalProduct: "Ativação DentalCAD Ultimate Lab Bundle - RMS (TESTE)",
    stripeProduct: "Exocad Ultimate Bundle (RMS) BRAZIL - Ativação e Implantação Inicial",
    paidAt: new Date(),
  };
  const res = await notifyExecutivesOfPayment(supabase, null, notice, "Teste Vendedor");
  return new Response(JSON.stringify({ ok: true, ...res }), {
    headers: { "Content-Type": "application/json" },
  });
});