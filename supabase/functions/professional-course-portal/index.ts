import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Campos do curso que o profissional pode gravar pelo portal
const COURSE_FIELDS = [
  "title", "subtitle", "description", "modality", "category", "cover_image_url",
  "price_brl", "promo_price_brl", "installments", "workload_hours", "duration_days",
  "start_date", "end_date", "start_time", "end_time", "schedule",
  "country", "state", "city", "venue", "address", "online_platform", "meeting_link",
  "max_students", "registration_url", "whatsapp_ddi", "whatsapp_number",
  "instagram", "course_platform", "video_url", "target_audience", "prerequisites",
  "syllabus", "materials_included", "certificate", "language", "tags",
  // status e public_visible: só a equipe muda (aprovação da Fase 3 KOL)
] as const;

const PROFILE_FIELDS = [
  "nome", "prof_cro", "prof_photo_url", "prof_mini_cv", "prof_course_platform",
  "prof_wa_ddi", "prof_wa_number", "prof_course_wa_ddi", "prof_course_wa_number",
  "instagram", "prof_tiktok", "prof_youtube", "prof_site", "prof_city", "prof_state",
] as const;

const NUMERIC = new Set(["price_brl", "promo_price_brl", "installments", "workload_hours", "duration_days", "max_students", "enrolled_count"]);
const DATE_FIELDS = new Set(["start_date", "end_date"]);

function pick(src: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (!(k in src)) continue;
    let v = src[k];
    if (typeof v === "string") {
      v = v.trim();
      if (v === "") v = null;
      else if (typeof v === "string" && v.length > 20000) v = v.slice(0, 20000);
    }
    if (NUMERIC.has(k)) {
      const n = v === null || v === "" ? null : Number(v);
      v = n === null || Number.isNaN(n) ? null : n;
    }
    if (DATE_FIELDS.has(k) && typeof v === "string") v = v.slice(0, 10);
    out[k] = v;
  }
  return out;
}

async function resolveToken(token: string) {
  if (!token || token.length < 12 || token.length > 128) return null;
  const { data } = await admin
    .from("professional_portal_tokens")
    .select("id, lead_id, expires_at, revoked_at, uses")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  await admin
    .from("professional_portal_tokens")
    .update({ last_used_at: new Date().toISOString(), uses: (data.uses ?? 0) + 1 })
    .eq("id", data.id);
  return data;
}

// Timeline KOL obrigatória (fn_kol_log). Rascunho: uma linha por curso e dia; envio: uma por envio.
async function logCourse(leadId: string, type: string, c: { id: string; title: string; status?: string }, desc: string, unique = false) {
  const day = new Date().toISOString().slice(0, 10);
  const { error } = await admin.rpc("fn_kol_log", {
    _lead_id: leadId, _event_type: type, _entity_type: "professional_course", _entity_id: c.id,
    _entity_name: c.title, _value: null, _channel: "kol",
    _data: { descricao: `${desc}: ${c.title}`, status: c.status ?? null, actor: "kol",
      dedupe_key: unique ? `${type}:${c.id}:${Date.now()}` : `${type}:${c.id}:${day}` },
  });
  if (error) console.error("[professional-course-portal] fn_kol_log", type, error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const token = String(body?.token ?? "");

    const session = await resolveToken(token);
    if (!session) return json({ error: "invalid_token" }, 401);
    const leadId = session.lead_id as string;

    if (action === "bootstrap") {
      const [{ data: prof }, { data: courses }] = await Promise.all([
        admin
          .from("lia_attendances")
          .select("id, nome, email, area_atuacao, especialidade, prof_photo_url, prof_cro, prof_mini_cv, prof_course_platform, prof_wa_ddi, prof_wa_number, prof_course_wa_ddi, prof_course_wa_number, instagram, prof_tiktok, prof_youtube, prof_site, prof_city, prof_state")
          .eq("id", leadId)
          .maybeSingle(),
        admin
          .from("professional_courses")
          .select("*")
          .eq("producer_lead_id", leadId)
          .order("created_at", { ascending: false }),
      ]);
      return json({ professional: prof, courses: courses ?? [] });
    }

    if (action === "save_course") {
      const input = (body?.course ?? {}) as Record<string, unknown>;
      const payload = pick(input, COURSE_FIELDS);
      if (!payload.title || String(payload.title).length < 3) {
        return json({ error: "O título do curso é obrigatório." }, 400);
      }
      const id = typeof input.id === "string" && input.id ? input.id : null;
      // enrolled_count é controlado só pelo sistema de inscrições (nunca pelo KOL)
      delete (payload as Record<string, unknown>).enrolled_count;
      if (payload.max_students != null) {
        const m = Number(payload.max_students);
        if (!Number.isInteger(m) || m < 1 || m > 5000) {
          return json({ error: "Número máximo de alunos inválido (1 a 5000)." }, 400);
        }
        if (id) {
          const { data: cur } = await admin.from("professional_courses")
            .select("enrolled_count").eq("id", id).eq("producer_lead_id", leadId).maybeSingle();
          if (cur && Number(cur.enrolled_count ?? 0) > m) {
            return json({ error: `Já existem ${cur.enrolled_count} inscritos; o máximo não pode ser menor.` }, 400);
          }
        }
      }
      if (id) {
        const { data: cur } = await admin.from("professional_courses")
          .select("status").eq("id", id).eq("producer_lead_id", leadId).maybeSingle();
        if (!cur) return json({ error: "not_found" }, 404);
        if (cur.status === "em_analise") return json({ error: "Curso em análise pela equipe; aguarde a resposta para editar." }, 409);
        if (cur.status === "publicado") return json({ error: "Curso publicado. Peça à equipe para despublicar antes de editar." }, 409);
        const { data, error } = await admin
          .from("professional_courses")
          .update(payload)
          .eq("id", id)
          .eq("producer_lead_id", leadId)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "not_found" }, 404);
        await logCourse(leadId, "kol_course_draft_saved", data, "Rascunho de curso salvo");
        return json({ course: data });
      }
      const { data, error } = await admin
        .from("professional_courses")
        .insert({ ...payload, producer_lead_id: leadId, created_source: "portal", status: "rascunho", public_visible: false })
        .select("*")
        .single();
      if (error) throw error;
      await logCourse(leadId, "kol_course_draft_saved", data, "Rascunho de curso salvo");
      return json({ course: data });
    }

    if (action === "submit_course") {
      const id = String(body?.course_id ?? "");
      const { data: cur } = await admin.from("professional_courses")
        .select("id, title, status, description, modality").eq("id", id).eq("producer_lead_id", leadId).maybeSingle();
      if (!cur) return json({ error: "not_found" }, 404);
      if (cur.status !== "rascunho") return json({ error: "Só rascunhos podem ser enviados para aprovação." }, 409);
      if (!cur.description || !cur.modality) return json({ error: "Preencha descrição e modalidade antes de enviar." }, 400);
      const { data, error } = await admin.from("professional_courses")
        .update({ status: "em_analise", public_visible: false, submitted_at: new Date().toISOString() })
        .eq("id", id).eq("producer_lead_id", leadId).select("*").single();
      if (error) throw error;
      await logCourse(leadId, "kol_course_submitted", data, "Curso enviado para aprovação", true);
      return json({ course: data });
    }

    if (action === "delete_course") {
      const id = String(body?.course_id ?? "");
      if (!id) return json({ error: "course_id obrigatório" }, 400);
      const { data: cur } = await admin.from("professional_courses")
        .select("status").eq("id", id).eq("producer_lead_id", leadId).maybeSingle();
      if (cur?.status === "publicado") return json({ error: "Curso publicado não pode ser excluído pelo portal." }, 409);
      const { error } = await admin
        .from("professional_courses")
        .delete()
        .eq("id", id)
        .eq("producer_lead_id", leadId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "save_profile") {
      const payload = pick((body?.professional ?? {}) as Record<string, unknown>, PROFILE_FIELDS);
      const { error } = await admin
        .from("lia_attendances")
        .update({ ...payload, prof_updated_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[professional-course-portal]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});