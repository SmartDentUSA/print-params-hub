// Temporary diagnostic: validates STRIPE_SECRET_KEY against the Stripe API.
// Never returns the key itself, only its prefix/length and the API result.
const KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

Deno.serve(async () => {
  const prefix = KEY ? `${KEY.slice(0, 8)}...` : null;
  if (!KEY) {
    return new Response(JSON.stringify({ ok: false, reason: "missing" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  let status = 0;
  let stripeError: string | null = null;
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    status = res.status;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      stripeError = (body as Record<string, { message?: string }>)?.error?.message ?? null;
    }
  } catch (err) {
    stripeError = (err as Error).message;
  }
  return new Response(
    JSON.stringify({ ok: status === 200, prefix, length: KEY.length, status, stripeError }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
