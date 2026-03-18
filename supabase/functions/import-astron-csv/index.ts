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

/* Parse quoted CSV field properly */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/* Parse CSV text into user objects */
function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
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
    nome: row["Nome Completo"] || "",
    email: (row["Email"] || "").trim().toLowerCase(),
    cpf: row["CPF"] || "",
    telefone: row["Telefone"] || "",
    genero: row["Gênero"] || row["Genero"] || "",
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

    let users: ReturnType<typeof mapRow>[];

    // Option 1: Download CSV from URL
    if (body.csv_url) {
      console.log(`[import-astron-csv] Downloading CSV from ${body.csv_url}`);
      const csvResp = await fetch(body.csv_url, { signal: AbortSignal.timeout(30000) });
      if (!csvResp.ok) throw new Error(`CSV download failed: ${csvResp.status}`);
      const csvText = await csvResp.text();
      const parsed = parseCSV(csvText);
      users = parsed.map(mapRow);
      console.log(`[import-astron-csv] Parsed ${users.length} rows from URL`);
    }
    // Option 2: Raw CSV text
    else if (body.csv_text) {
      const parsed = parseCSV(body.csv_text);
      users = parsed.map(mapRow);
      console.log(`[import-astron-csv] Parsed ${users.length} rows from text`);
    }
    // Option 3: Pre-parsed array
    else if (Array.isArray(body.users)) {
      users = body.users;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide 'users', 'csv_text', or 'csv_url'" }),
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

    // Deduplicate by email
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
      console.log(`[import-astron-csv] Chunk ${i / CHUNK + 1}: emails ${i + 1}-${i + chunk.length}`);

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

      const matchedInChunk = new Set<string>();

      for (const email of chunk) {
        const matchedLeads = leadsByEmail.get(email);
        if (!matchedLeads || matchedLeads.length === 0) {
          totalNotFound++;
          continue;
        }

        matchedInChunk.add(email);
        const csvUser = emailMap.get(email)!;
        const pct = parsePercentual(csvUser.percentual);

        for (const lead of matchedLeads) {
          totalMatched++;

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
            if (sampleUpdates.length < 10) {
              sampleUpdates.push({ email, astron_created_at: parseDate(csvUser.data_cadastro), percentual: pct });
            }
          }
        }
      }

      // Count not_found from chunk
      for (const email of chunk) {
        if (!matchedInChunk.has(email) && !leadsByEmail.has(email)) {
          // already counted above
        }
      }
    }

    console.log(`[import-astron-csv] COMPLETE: matched=${totalMatched}, updated=${totalUpdated}, not_found=${totalNotFound}, errors=${errors.length}`);

    return new Response(
      JSON.stringify({
        matched: totalMatched,
        updated: totalUpdated,
        not_found: totalNotFound,
        total_csv: users.length,
        unique_emails: allEmails.length,
        sample_updates: sampleUpdates,
        errors: errors.slice(0, 30),
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
