/**
 * meta-audience-sync
 * Faz upload da base completa de contatos do CRM para um Custom Audience no Meta.
 * Agendado diariamente às 00:00 BRT via pg_cron.
 *
 * Env vars:
 *   META_LEAD_ADS_TOKEN    — System User token
 *   META_AD_ACCOUNT_ID     — formato "act_XXXXXXXXX" (usado só na criação inicial)
 *   META_AUDIENCE_ID       — ID do Custom Audience (setado após primeira execução)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_URL  = "https://graph.facebook.com/v21.0";
const BATCH_SIZE = 9_000; // Meta aceita até 10k por lote
const PAGE_SIZE  = 5_000; // linhas por query no banco

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha256hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.toLowerCase().trim());
  const buf   = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  const META_TOKEN    = Deno.env.get("META_LEAD_ADS_TOKEN");
  const AD_ACCOUNT_ID = Deno.env.get("META_AD_ACCOUNT_ID");
  let   AUDIENCE_ID   = Deno.env.get("META_AUDIENCE_ID");

  if (!META_TOKEN) return json({ error: "META_LEAD_ADS_TOKEN not set" }, 500);
  if (!AUDIENCE_ID && !AD_ACCOUNT_ID) {
    return json({ error: "set META_AUDIENCE_ID or META_AD_ACCOUNT_ID" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── criar audience se ainda não existe ──────────────────────────────────

  if (!AUDIENCE_ID) {
    const resp = await fetch(
      `${GRAPH_URL}/${AD_ACCOUNT_ID}/customaudiences?access_token=${META_TOKEN}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:                 "SmartDent CRM — Base Completa",
          subtype:              "CUSTOM",
          description:          "Todos os contatos do CRM SmartDent. Atualizado diariamente às 00h.",
          customer_file_source: "USER_PROVIDED_ONLY",
        }),
      },
    );
    const result = await resp.json();
    if (!result.id) {
      console.error("[audience-sync] Falha ao criar audience:", JSON.stringify(result));
      return json({ error: "failed to create audience", detail: result }, 500);
    }
    AUDIENCE_ID = result.id as string;
    console.log("[audience-sync] Audience criada:", AUDIENCE_ID, "— salve como META_AUDIENCE_ID");
  }

  // ── buscar toda a base de pessoas ────────────────────────────────────────

  type Person = { email: string | null; telefone_normalized: string | null; nome: string | null };
  const allPeople: Person[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("people")
      .select("email, telefone_normalized, nome")
      .or("email.not.is.null,telefone_normalized.not.is.null")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[audience-sync] Erro DB:", error);
      return json({ error: "db error", detail: error }, 500);
    }
    if (!data || data.length === 0) break;
    allPeople.push(...(data as Person[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log("[audience-sync] Total de pessoas:", allPeople.length);

  // ── hashear ──────────────────────────────────────────────────────────────

  const COUNTRY_HASH = await sha256hex("br");

  const hashedRows = await Promise.all(
    allPeople.map(async (p) => {
      const email = p.email ? await sha256hex(p.email) : "";

      let phone = "";
      if (p.telefone_normalized) {
        const d = digitsOnly(p.telefone_normalized);
        if (d.length >= 10) phone = await sha256hex(d);
      }

      const parts = p.nome?.trim().split(/\s+/) ?? [];
      const fn = parts[0]            ? await sha256hex(parts[0])            : "";
      const ln = parts.length > 1    ? await sha256hex(parts[parts.length - 1]) : "";

      return [email, phone, fn, ln, COUNTRY_HASH];
    }),
  );

  // ── enviar via usersreplace (substitui toda a audience de uma vez) ───────

  const sessionId = Date.now().toString();
  const batches   = chunk(hashedRows, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const isLast = i === batches.length - 1;

    const resp = await fetch(
      `${GRAPH_URL}/${AUDIENCE_ID}/usersreplace?access_token=${META_TOKEN}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            session_id:          sessionId,
            batch_seq:           i + 1,
            last_batch_flag:     isLast,
            estimated_num_total: hashedRows.length,
          },
          payload: {
            schema: ["EMAIL", "PHONE", "FN", "LN", "COUNTRY"],
            data:   batches[i],
          },
        }),
      },
    );

    const result = await resp.json();
    console.log(`[audience-sync] Lote ${i + 1}/${batches.length}:`, JSON.stringify(result));

    if (!resp.ok) {
      return json({ error: "meta api error", batch: i + 1, detail: result }, 500);
    }
  }

  return json({
    ok:           true,
    audience_id:  AUDIENCE_ID,
    total_people: allPeople.length,
    batches:      batches.length,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
