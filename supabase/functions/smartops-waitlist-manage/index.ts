// Gestão da lista de espera: cancelar inscrição (avisa o 1º da fila) e confirmar inscrição de quem espera.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VACANCY_TEMPLATE = `Olá, {{nome}}! 👋

Boa notícia: abriu uma vaga no treinamento *{{curso}}* ({{turma_label}}) porque houve uma desistência.

Você é o(a) próximo(a) da lista de espera. Se ainda tiver interesse, responda esta mensagem o mais rápido possível para garantirmos a sua vaga! 🙌

*{{cs_nome}}*`;

function formatPhone(raw: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : "55" + d;
}

// deno-lint-ignore no-explicit-any
async function notifyVacancy(db: any, turmaId: string) {
  const { data: w } = await db.from("smartops_turma_waitlist").select("*")
    .eq("turma_id", turmaId).is("vacancy_notified_at", null)
    .order("created_at").limit(1).maybeSingle();
  if (!w) return { notified: false, reason: "lista de espera vazia" };

  const { data: turma } = await db.from("smartops_course_turmas").select("label, course_id").eq("id", turmaId).maybeSingle();
  const { data: course } = await db.from("smartops_courses").select("title, wa_instance_name").eq("id", w.course_id || turma?.course_id).maybeSingle();
  const instance = course?.wa_instance_name || Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
  const { data: cs } = await db.from("team_members").select("id, nome_completo").eq("evolution_instance_name", instance).maybeSingle();
  const fail = async (msg: string) => {
    await db.from("smartops_turma_waitlist").update({ vacancy_error: msg }).eq("id", w.id);
    return { notified: false, name: w.person_name, reason: msg };
  };
  if (!cs) return fail("WhatsApp do CS não encontrado");
  let phoneRaw = w.phone as string | null;
  if (!phoneRaw && w.lead_id) {
    const { data: lead } = await db.from("lia_attendances").select("telefone").eq("id", w.lead_id).is("merged_into", null).maybeSingle();
    phoneRaw = lead?.telefone ?? null;
  }
  const phone = phoneRaw ? formatPhone(phoneRaw) : null;
  if (!phone) return fail("sem telefone válido");

  const message = VACANCY_TEMPLATE
    .replace(/\{\{nome\}\}/g, (w.person_name || "").split(" ")[0])
    .replace(/\{\{curso\}\}/g, course?.title ?? "")
    .replace(/\{\{turma_label\}\}/g, turma?.label ?? "")
    .replace(/\{\{cs_nome\}\}/g, cs.nome_completo ?? "");

  const { data: sent, error } = await db.functions.invoke("smart-ops-wa-send", {
    body: { to: phone, message, lead_id: w.lead_id, team_member_id: cs.id, source: "course_waitlist_vacancy",
      metadata: { waitlist_id: w.id, turma_id: turmaId } },
  });
  if (error || sent?.success === false || sent?.error) return fail(String(error ?? sent?.error ?? "Falha no envio").slice(0, 500));
  await db.from("smartops_turma_waitlist").update({ vacancy_notified_at: new Date().toISOString(), vacancy_error: null }).eq("id", w.id);
  return { notified: true, name: w.person_name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id inválido" }, 400);
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (action === "cancel") {
      const { data: e } = await db.from("smartops_course_enrollments").select("id, turma_id, status").eq("id", id).maybeSingle();
      if (!e) return json({ error: "inscrição não encontrada" }, 404);
      if (e.status !== "cancelado") {
        const { error } = await db.from("smartops_course_enrollments").update({ status: "cancelado" }).eq("id", id);
        if (error) return json({ error: error.message }, 400);
      }
      const vacancy = await notifyVacancy(db, e.turma_id);
      return json({ ok: true, vacancy });
    }

    if (action === "promote") {
      const { data: w } = await db.from("smartops_turma_waitlist").select("*").eq("id", id).maybeSingle();
      if (!w) return json({ error: "registro não encontrado" }, 404);
      const { data: turma } = await db.from("smartops_course_turmas").select("course_id").eq("id", w.turma_id).maybeSingle();
      let leadId = w.lead_id as string | null;
      if (!leadId && w.phone) {
        const digits = String(w.phone).replace(/\D/g, "");
        const { data: lead } = await db.from("lia_attendances").select("id").is("merged_into", null)
          .ilike("telefone_normalized", `%${digits.slice(-9)}`).limit(1).maybeSingle();
        leadId = lead?.id ?? null;
      }
      const { data: ins, error } = await db.from("smartops_course_enrollments").insert({
        course_id: w.course_id || turma?.course_id, turma_id: w.turma_id, lead_id: leadId,
        person_name: w.person_name, status: "agendado", source: "waitlist", enrolled_at: new Date().toISOString(),
        notes: "Confirmado a partir da lista de espera",
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      await db.from("smartops_turma_waitlist").delete().eq("id", id);
      return json({ ok: true, enrollment_id: ins.id });
    }
    return json({ error: "ação inválida" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
