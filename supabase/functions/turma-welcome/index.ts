import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BLOCKED = ["cancelado", "cancelada", "ausente", "no_show"];

// Nome curto para telão: "Dr. João Pedro Silva" -> "João Pedro"
function displayName(raw: string): string {
  const clean = String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|dra|drª|prof|profa)\.?\s+/i, "");
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length <= 2) return clean;
  return `${parts[0]} ${parts[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const nRaw = url.searchParams.get("n") ?? url.searchParams.get("turma_number");
    const n = Number(String(nRaw || "").replace(/\D/g, ""));
    if (!n) return json({ error: "turma_number_required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: turma, error: tErr } = await supabase
      .from("smartops_course_turmas")
      .select("id, label, turma_number, modality, location, start_date, end_date, course_id")
      .eq("turma_number", n)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!turma) return json({ error: "turma_not_found" }, 404);

    const { data: course } = await supabase
      .from("smartops_courses")
      .select("title, instructor_name, location, modality")
      .eq("id", turma.course_id)
      .maybeSingle();

    const { data: enrollments, error: eErr } = await supabase
      .from("smartops_course_enrollments")
      .select("id, person_name, status, empresa_estado, empresa_cidade, lead_id")
      .eq("turma_id", turma.id)
      .order("person_name");
    if (eErr) throw eErr;

    const valid = (enrollments || []).filter(
      (e) => !BLOCKED.includes(String(e.status || "").toLowerCase()),
    );

    let companions: Array<{ enrollment_id: string; name: string }> = [];
    if (valid.length) {
      const { data: comps } = await supabase
        .from("smartops_enrollment_companions")
        .select("enrollment_id, name")
        .in("enrollment_id", valid.map((e) => e.id));
      companions = comps || [];
    }

    // Estado (UF) — enrollment primeiro, fallback no lead
    const leadIds = valid.map((e) => (e as any).lead_id).filter(Boolean);
    const leadUf = new Map<string, string>();
    if (leadIds.length) {
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, empresa_estado, estado")
        .in("id", leadIds);
      for (const l of leads || []) {
        const uf = String((l as any).empresa_estado || (l as any).estado || "").trim();
        if (uf) leadUf.set(String((l as any).id), uf);
      }
    }
    const normUf = (v: string) => {
      const t = String(v || "").trim();
      return t.length <= 3 ? t.toUpperCase() : t;
    };

    const participants = valid.map((e) => ({
      name: displayName(e.person_name || ""),
      state: normUf((e as any).empresa_estado || leadUf.get(String((e as any).lead_id)) || ""),
      city: String((e as any).empresa_cidade || "").trim() || null,
      full_name: String(e.person_name || "").trim(),
      companions: companions
        .filter((c) => c.enrollment_id === e.id)
        .map((c) => displayName(c.name || ""))
        .filter(Boolean),
    })).filter((p) => p.name);

    return json({
      turma: {
        number: turma.turma_number,
        label: turma.label,
        modality: turma.modality || course?.modality || null,
        location: turma.location || course?.location || null,
        start_date: turma.start_date,
        end_date: turma.end_date,
      },
      course: {
        title: course?.title || "Treinamento Smart Dent",
        instructor_name: course?.instructor_name || null,
      },
      participants,
      total_people:
        participants.length + participants.reduce((s, p) => s + p.companions.length, 0),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
