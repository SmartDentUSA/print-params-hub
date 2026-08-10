import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The caller must already know the identifiers (they typed them on the public
// enrollment form). We only echo back non-sensitive profile fields and MASKED
// identifiers so the visitor can confirm "these data are correct?".
const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(20),
});

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if ((digits.length === 13 || digits.length === 12) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

function maskEmail(v?: string | null): string | null {
  if (!v) return null;
  const [user, domain] = v.split("@");
  if (!domain) return null;
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

function maskPhone(v?: string | null): string | null {
  const d = (v || "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `(${d.slice(0, 2)}) ****-${d.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = parsed.data.email.toLowerCase().trim();
    const phone = normalizePhone(parsed.data.telefone);

    const { data: leads } = await supabase
      .from("lia_attendances")
      .select(
        "id, nome, email, telefone, area_atuacao, especialidade, cidade, empresa_nome, piperun_id, omie_cliente_id, real_status",
      )
      .or(`email.eq.${email},telefone.eq.${phone}`)
      .is("merged_into", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    const lead = leads?.[0];
    if (!lead) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        found: true,
        nome: lead.nome ?? null,
        area_atuacao: lead.area_atuacao ?? null,
        especialidade: lead.especialidade ?? null,
        cidade: lead.cidade ?? null,
        empresa: lead.empresa_nome ?? null,
        email_masked: maskEmail(lead.email),
        telefone_masked: maskPhone(lead.telefone),
        is_client: Boolean(lead.piperun_id || lead.omie_cliente_id),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[public-lead-lookup]", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
