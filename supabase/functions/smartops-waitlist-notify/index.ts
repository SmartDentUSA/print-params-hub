// Envia a mensagem "você está na lista de espera" pelo WhatsApp do CS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const id = String(body.waitlist_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "waitlist_id inválido" }, 400);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: w } = await db.from("smartops_turma_waitlist").select("*").eq("id", id).maybeSingle();
  if (!w) return json({ error: "registro não encontrado" }, 404);

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
    return json({ error: msg }, status);
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

  const { error } = await db.functions.invoke("smart-ops-wa-send", {
    body: { to: phone, message, lead_id: w.lead_id, team_member_id: cs.id, source: "course_waitlist",
      metadata: { waitlist_id: id, course_id: courseId, turma_id: w.turma_id } },
  });
  if (error) return fail(String(error).slice(0, 500), 502);
  await db.from("smartops_turma_waitlist").update({ wa_sent_at: new Date().toISOString(), wa_error: null }).eq("id", id);
  return json({ ok: true });
});
