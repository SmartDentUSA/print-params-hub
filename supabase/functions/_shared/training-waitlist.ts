import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const DEFAULT_WAITLIST_TEMPLATE = `Olá, {{nome}}! 👋

As vagas do treinamento *{{curso}}* ({{turma_label}}) estão esgotadas no momento, mas você está na nossa *lista de espera* ✅

Assim que uma vaga for liberada, entraremos em contato por aqui.

*{{cs_nome}}*`;

function fmtDateBR(iso: string) { return iso ? iso.split("-").reverse().join("/") : ""; }
function formatPhone(raw: string): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : "55" + d;
}

export async function notifyWaitlist(db: SupabaseClient, id: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const { data: w } = await db.from("smartops_turma_waitlist").select("*").eq("id", id).maybeSingle();
  if (!w) return { ok: false, error: "registro não encontrado", status: 404 };

  if (w.wa_sent_at) return { ok: true };

  const { data: turma } = await db.from("smartops_course_turmas").select("id, label, course_id").eq("id", w.turma_id).maybeSingle();
  const courseId = w.course_id || turma?.course_id;
  const { data: course } = await db.from("smartops_courses")
    .select("id, title, wa_instance_name, waitlist_message_template").eq("id", courseId).maybeSingle();
  const { data: day } = await db.from("smartops_turma_days").select("date, start_time")
    .eq("turma_id", w.turma_id).order("day_number").limit(1).maybeSingle();

  const instance = course?.wa_instance_name || Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
  const { data: cs } = await db.from("team_members").select("id, nome_completo, evolution_instance_name")
    .eq("evolution_instance_name", instance).maybeSingle();
  const fail = async (msg: string, status = 400) => {
    await db.from("smartops_turma_waitlist").update({ wa_error: msg }).eq("id", id);
    return { ok: false, error: msg, status };
  };
  if (!cs) return fail("WhatsApp do CS não encontrado");

  let phoneRaw = w.phone as string | null;
  if (!phoneRaw && w.lead_id) {
    const { data: lead } = await db.from("lia_attendances").select("telefone").eq("id", w.lead_id).is("merged_into", null).maybeSingle();
    phoneRaw = lead?.telefone ?? null;
  }
  const phone = phoneRaw ? formatPhone(phoneRaw) : null;
  if (!phone) return fail("sem telefone válido");

  const tpl = course?.waitlist_message_template || DEFAULT_WAITLIST_TEMPLATE;
  const message = tpl
    .replace(/\{\{nome\}\}/g, (w.person_name || "").split(" ")[0])
    .replace(/\{\{curso\}\}/g, course?.title ?? "")
    .replace(/\{\{turma_label\}\}/g, turma?.label ?? "")
    .replace(/\{\{data_inicio\}\}/g, fmtDateBR(day?.date ?? ""))
    .replace(/\{\{horario_inicio\}\}/g, (day?.start_time ?? "").substring(0, 5))
    .replace(/\{\{cs_nome\}\}/g, cs.nome_completo ?? "")
    .replace(/\{\{[a-z_]+\}\}/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();

  const { data: sent, error } = await db.functions.invoke("smart-ops-wa-send", {
    body: { to: phone, message, lead_id: w.lead_id, team_member_id: cs.id, source: "course_waitlist",
      metadata: { waitlist_id: id, course_id: courseId, turma_id: w.turma_id } },
  });
  if (error || sent?.success === false || sent?.error) return fail(String(error ?? sent?.error ?? "Falha no envio").slice(0, 500), 502);
  await db.from("smartops_turma_waitlist").update({ wa_sent_at: new Date().toISOString(), wa_error: null }).eq("id", id);
  return { ok: true };
}
