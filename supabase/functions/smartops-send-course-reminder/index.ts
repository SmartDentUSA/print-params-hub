import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_REMINDER_TEMPLATE = `Olá, {{nome}}! 👋

⏰ Lembrete: seu treinamento *{{curso}}* começa em *1 hora*, às {{horario_inicio}}.

{{link_reuniao}}

{{grupo_whatsapp}}

Até já!
*{{cs_nome}}*`;

function fmtDateBR(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "";
}

function interpolate(tpl: string, v: Record<string, string>) {
  const grupoLine = v.grupo_whatsapp
    ? `📱 *Entre no grupo de WhatsApp do seu treinamento:*\n👉 ${v.grupo_whatsapp}`
    : "";
  const reuniaoLine = v.link_reuniao
    ? `💻 *Link da reunião (aula online):*\n👉 ${v.link_reuniao}`
    : "";
  return tpl
    .replace(/\{\{nome\}\}/g, v.nome ?? "")
    .replace(/\{\{curso\}\}/g, v.curso ?? "")
    .replace(/\{\{turma_label\}\}/g, v.turma_label ?? "")
    .replace(/\{\{horario_inicio\}\}/g, v.horario_inicio ?? "")
    .replace(/\{\{data_inicio\}\}/g, fmtDateBR(v.data_inicio ?? ""))
    .replace(/\{\{grupo_whatsapp\}\}/g, grupoLine)
    .replace(/\{\{link_reuniao\}\}/g, reuniaoLine)
    .replace(/\{\{cs_nome\}\}/g, v.cs_nome ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  try {
    // Janela: agora .. agora+5min (cron roda a cada 5min)
    const now = new Date();
    const horizon = new Date(now.getTime() + 5 * 60 * 1000);

    const { data: pending, error: qErr } = await supabase
      .from("smartops_course_enrollments")
      .select(`
        id, lead_id, person_name, turma_snapshot, course_id, turma_id, cs_team_member_id,
        course:smartops_courses!inner(
          id, title, modality, instructor_name, whatsapp_group_link, meeting_link
        )
      `)
      .is("wa_reminder_sent_at", null)
      .eq("status", "agendado")
      .not("wa_reminder_scheduled_for", "is", null)
      .lte("wa_reminder_scheduled_for", horizon.toISOString())
      .gte("wa_reminder_scheduled_for", new Date(now.getTime() - 30 * 60 * 1000).toISOString())
      .limit(50);

    if (qErr) throw qErr;

    for (const e of pending ?? []) {
      try {
        const course: any = (e as any).course;
        if (!course || !["online_ao_vivo", "online"].includes(course.modality)) continue;

        // Reentrância: claim atômico marcando sent_at = now (evita double-send se falhar)
        const claimedAt = new Date().toISOString();
        const { data: claim } = await supabase
          .from("smartops_course_enrollments")
          .update({ wa_reminder_sent_at: claimedAt })
          .eq("id", (e as any).id)
          .is("wa_reminder_sent_at", null)
          .select("id")
          .maybeSingle();
        if (!claim) continue;

        if (!(e as any).cs_team_member_id) {
          failed.push({ id: (e as any).id, error: "cs_team_member_id ausente" });
          await supabase.from("smartops_course_enrollments").update({
            wa_reminder_sent_at: null,
            wa_reminder_error: "cs_team_member_id ausente",
          }).eq("id", (e as any).id);
          continue;
        }

        const { data: cs } = await supabase
          .from("team_members")
          .select("id, nome_completo, waleads_api_key")
          .eq("id", (e as any).cs_team_member_id)
          .maybeSingle();

        if (!cs?.waleads_api_key) {
          failed.push({ id: (e as any).id, error: "CS sem waleads_api_key" });
          await supabase.from("smartops_course_enrollments").update({
            wa_reminder_sent_at: null,
            wa_reminder_error: "CS sem waleads_api_key",
          }).eq("id", (e as any).id);
          continue;
        }

        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("telefone")
          .eq("id", (e as any).lead_id)
          .is("merged_into", null)
          .maybeSingle();

        const phone = lead?.telefone ? formatPhone(lead.telefone) : null;
        if (!phone) {
          await supabase.from("smartops_course_enrollments").update({
            wa_reminder_sent_at: new Date().toISOString(),
            wa_reminder_error: "sem telefone",
          }).eq("id", (e as any).id);
          continue;
        }

        const snap: any = (e as any).turma_snapshot ?? {};
        const days: any[] = Array.isArray(snap.days) ? snap.days : [];
        const d0 = days[0] ?? {};
        const message = interpolate(DEFAULT_REMINDER_TEMPLATE, {
          nome: (e as any).person_name ?? "",
          curso: course.title ?? "",
          turma_label: snap.label ?? "",
          horario_inicio: (d0.start_time ?? "").substring(0, 5),
          data_inicio: d0.date ?? "",
          grupo_whatsapp: snap.whatsapp_group_link || course.whatsapp_group_link || "",
          link_reuniao: course.meeting_link || snap.meeting_link || "",
          cs_nome: cs.nome_completo ?? "",
        });

        const { error: sendErr } = await supabase.functions.invoke("smart-ops-send-waleads", {
          body: {
            to: phone,
            message,
            waleads_api_key: cs.waleads_api_key,
            lead_id: (e as any).lead_id,
            team_member_id: cs.id,
            source: "enrollment_reminder_1h",
            metadata: {
              enrollment_id: (e as any).id,
              course_id: course.id,
              turma_id: (e as any).turma_id,
            },
          },
        });

        if (sendErr) {
          failed.push({ id: (e as any).id, error: String(sendErr) });
          await supabase.from("smartops_course_enrollments").update({
            wa_reminder_sent_at: null,
            wa_reminder_error: String(sendErr).slice(0, 500),
          }).eq("id", (e as any).id);
        } else {
          await supabase.from("smartops_course_enrollments").update({
            wa_reminder_sent_at: new Date().toISOString(),
            wa_reminder_error: null,
          }).eq("id", (e as any).id);
          sent.push((e as any).id);
        }
      } catch (err: any) {
        failed.push({ id: (e as any).id, error: err?.message ?? String(err) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: pending?.length ?? 0, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});