import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseDate(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  // Format: "19/03/2024 - 13:24"
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-?\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
}

function parsePercentual(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseInt(String(raw).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { users } = await req.json();
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "users array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Normalize emails
    const emailMap = new Map<string, typeof users[0]>();
    for (const u of users) {
      const email = (u.email || "").trim().toLowerCase();
      if (email && email.includes("@")) {
        emailMap.set(email, u);
      }
    }

    const allEmails = [...emailMap.keys()];
    let totalMatched = 0;
    let totalUpdated = 0;
    let totalNotFound = 0;
    const errors: string[] = [];

    // Process in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < allEmails.length; i += CHUNK) {
      const chunk = allEmails.slice(i, i + CHUNK);

      // Bulk load existing leads
      const { data: leads, error: fetchErr } = await supabase
        .from("lia_attendances")
        .select("id, email, astron_courses_access")
        .in("email", chunk);

      if (fetchErr) {
        errors.push(`Fetch chunk ${i}: ${fetchErr.message}`);
        continue;
      }

      if (!leads || leads.length === 0) {
        totalNotFound += chunk.length;
        continue;
      }

      // Build email→lead map
      const leadMap = new Map<string, typeof leads[0]>();
      for (const ld of leads) {
        if (ld.email) leadMap.set(ld.email.toLowerCase(), ld);
      }

      // Update each matched lead
      for (const email of chunk) {
        const lead = leadMap.get(email);
        if (!lead) {
          totalNotFound++;
          continue;
        }

        totalMatched++;
        const csvUser = emailMap.get(email)!;

        // Merge into astron_courses_access: preserve existing array entries
        let existingAccess: unknown[] = [];
        if (Array.isArray(lead.astron_courses_access)) {
          existingAccess = lead.astron_courses_access;
        }

        // Remove old astronmembers entries, add new one
        const filtered = existingAccess.filter(
          (e: any) => e?.source !== "astronmembers"
        );
        filtered.push({
          source: "astronmembers",
          percentual_conclusao: parsePercentual(csvUser.percentual),
          cpf: csvUser.cpf || null,
          genero: csvUser.genero || null,
          data_nascimento: csvUser.data_nascimento || null,
          imported_at: new Date().toISOString(),
        });

        const { error: upErr } = await supabase
          .from("lia_attendances")
          .update({
            astron_status: "active",
            astron_nome: csvUser.nome || null,
            astron_phone: csvUser.telefone || null,
            astron_created_at: parseDate(csvUser.data_cadastro),
            astron_last_login_at: parseDate(csvUser.ultimo_login),
            astron_login_url: "https://smartdentacademy.astronmembers.com/",
            astron_synced_at: new Date().toISOString(),
            astron_courses_access: filtered,
          })
          .eq("id", lead.id);

        if (upErr) {
          errors.push(`Update ${email}: ${upErr.message}`);
        } else {
          totalUpdated++;
        }
      }
    }

    console.log(`[import-astron-csv] Done: matched=${totalMatched}, updated=${totalUpdated}, not_found=${totalNotFound}, errors=${errors.length}`);

    return new Response(
      JSON.stringify({
        matched: totalMatched,
        updated: totalUpdated,
        not_found: totalNotFound,
        total_csv: users.length,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[import-astron-csv] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
