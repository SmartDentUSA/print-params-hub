// deno-lint-ignore-file no-explicit-any
// Função TEMPORÁRIA de teste: dispara a notificação de pagamento Stripe.
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyExecutivesOfPayment, type PaymentNotice } from "../_shared/stripe-notify.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async () => {
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