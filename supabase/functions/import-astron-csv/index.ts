import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseDate(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
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

/* Parse CSV text (semicolon or comma delimited) into user objects */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ""));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(delim).map(v => v.trim().replace(/^"|"$/g, ""));
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
    rows.push(row);
  }
  return rows;
}

/* Map CSV headers to standardized fields */
function mapRow(row: Record<string, string>) {
  return {
    nome: row["Nome Completo"] || row["nome"] || "",
    email: (row["Email"] || row["email"] || "").trim().toLowerCase(),
    cpf: row["CPF"] || row["cpf"] || "",
    telefone: row["Telefone"] || row["telefone"] || "",
    genero: row["Gênero"] || row["Genero"] || row["genero"] || "",
    data_nascimento: row["Data de Nascimento"] || "",
    data_cadastro: row["Data de Cadastro"] || "",
    ultimo_login: row["Data de Último Login"] || row["Data de Ultimo Login"] || "",
    percentual: row["Percentual de Conclusão"] || row["Percentual de Conclusao"] || "0%",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Accept either { users: [...] } (pre-parsed) or { csv_text: "..." } (raw CSV)
    let users: { nome: string; email: string; cpf: string; telefone: string; genero: string; data_nascimento: string; data_cadastro: string; ultimo_login: string; percentual: string }[];

    if (body.csv_text) {
      const parsed = parseCSV(body.csv_text);
      users = parsed.map(mapRow);
      console.log(`[import-astron-csv] Parsed ${users.length} rows from CSV text`);
    } else if (Array.isArray(body.users)) {
      users = body.users;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide 'users' array or 'csv_text' string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users to import" }),
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
      const email = u.email?.trim().toLowerCase();
      if (email && email.includes("@")) {
        emailMap.set(email, u);
      }
    }

    const allEmails = [...emailMap.keys()];
    let totalMatched = 0;
    let totalUpdated = 0;
    let totalNotFound = 0;
    const errors: string[] = [];
    const sampleUpdates: { email: string; astron_created_at: string | null; percentual: number }[] = [];

    console.log(`[import-astron-csv] Processing ${allEmails.length} unique emails`);

    // Process in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < allEmails.length; i += CHUNK) {
      const chunk = allEmails.slice(i, i + CHUNK);

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

      // Build email→lead map (handle multiple leads with same email)
      const leadsByEmail = new Map<string, typeof leads>();
      for (const ld of leads) {
        const e = ld.email?.toLowerCase();
        if (!e) continue;
        if (!leadsByEmail.has(e)) leadsByEmail.set(e, []);
        leadsByEmail.get(e)!.push(ld);
      }

      for (const email of chunk) {
        const matchedLeads = leadsByEmail.get(email);
        if (!matchedLeads || matchedLeads.length === 0) {
          totalNotFound++;
          continue;
        }

        const csvUser = emailMap.get(email)!;
        const pct = parsePercentual(csvUser.percentual);

        // Update ALL leads with this email
        for (const lead of matchedLeads) {
          totalMatched++;

          // Preserve existing array, add/replace astronmembers entry
          let existingAccess: unknown[] = [];
          if (Array.isArray(lead.astron_courses_access)) {
            existingAccess = lead.astron_courses_access;
          }

          const filtered = existingAccess.filter(
            (e: any) => e?.source !== "astronmembers"
          );
          filtered.push({
            source: "astronmembers",
            percentual_conclusao: pct,
            cpf: csvUser.cpf || null,
            genero: csvUser.genero || null,
            data_nascimento: csvUser.data_nascimento || null,
            imported_at: new Date().toISOString(),
          });

          const createdAt = parseDate(csvUser.data_cadastro);
          const lastLogin = parseDate(csvUser.ultimo_login);

          const { error: upErr } = await supabase
            .from("lia_attendances")
            .update({
              astron_status: "active",
              astron_nome: csvUser.nome || null,
              astron_phone: csvUser.telefone || null,
              astron_created_at: createdAt,
              astron_last_login_at: lastLogin,
              astron_login_url: "https://smartdentacademy.astronmembers.com/",
              astron_synced_at: new Date().toISOString(),
              astron_courses_access: filtered,
            })
            .eq("id", lead.id);

          if (upErr) {
            errors.push(`Update ${email}: ${upErr.message}`);
          } else {
            totalUpdated++;
            if (sampleUpdates.length < 5) {
              sampleUpdates.push({ email, astron_created_at: createdAt, percentual: pct });
            }
          }
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
        unique_emails: allEmails.length,
        sample_updates: sampleUpdates,
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
