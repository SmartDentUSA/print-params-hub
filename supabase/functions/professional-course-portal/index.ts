import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import {
  getDriveAccessToken,
  driveEnsureFolder,
  driveUploadFile,
  driveGetWebViewLink,
  sanitizeFolderName,
} from "../_shared/drive.ts";

import { kolPerformance } from "./performance.ts";

// Pasta principal dos KOLs no Google Drive (contratos assinados)
const KOL_DRIVE_PARENT_FOLDER = "16jeyfsU5dhzbYvYpk0d7d8_HFe_HnC9S";
const CONTRACT_VALIDITY_MONTHS = 12;

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
  "syllabus", "materials_included", "certificate", "language", "tags", "reels_video_url",
  // status e public_visible: só a equipe muda (aprovação da Fase 3 KOL)
] as const;

const PROFILE_FIELDS = [
  "nome", "prof_cro", "prof_photo_url", "prof_mini_cv", "prof_course_platform",
  "prof_wa_ddi", "prof_wa_number", "prof_course_wa_ddi", "prof_course_wa_number",
  "instagram", "prof_tiktok", "prof_youtube", "prof_site", "prof_city", "prof_state",
  "area_atuacao", "especialidade",
  "prof_cep", "pessoa_endereco", "pessoa_cpf", "empresa_cnpj",
  "prof_qualifications", "prof_university_roles",
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
          .select("id, nome, email, area_atuacao, especialidade, prof_photo_url, prof_cro, prof_mini_cv, prof_course_platform, prof_wa_ddi, prof_wa_number, prof_course_wa_ddi, prof_course_wa_number, instagram, prof_tiktok, prof_youtube, prof_site, prof_city, prof_state, prof_cep, pessoa_endereco, pessoa_cpf, empresa_cnpj, prof_qualifications, prof_university_roles")
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
        .select("id, title, status").eq("id", id).eq("producer_lead_id", leadId).maybeSingle();
      if (!cur) return json({ error: "not_found" }, 404);
      if (cur.status !== "rascunho") return json({ error: "Só cursos em rascunho podem ser excluídos pelo portal." }, 409);
      const { error } = await admin
        .from("professional_courses")
        .delete()
        .eq("id", id)
        .eq("producer_lead_id", leadId);
      if (error) throw error;
      await logCourse(leadId, "kol_course_deleted", cur, "Rascunho de curso excluído", true);
      return json({ ok: true });
    }

    if (action === "save_profile") {
      const payload = pick((body?.professional ?? {}) as Record<string, unknown>, PROFILE_FIELDS);
      const { data: before } = await admin.from("lia_attendances")
        .select(PROFILE_FIELDS.join(", ")).eq("id", leadId).maybeSingle();
      const antes: Record<string, unknown> = {}; const depois: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        const old = (before as Record<string, unknown> | null)?.[k] ?? null;
        if (JSON.stringify(old ?? null) !== JSON.stringify(v ?? null)) { antes[k] = old; depois[k] = v; }
      }
      if (Object.keys(depois).length === 0) return json({ ok: true, changed: 0 });
      const { error } = await admin
        .from("lia_attendances")
        .update({ ...depois, prof_updated_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
      const { error: logErr } = await admin.rpc("fn_kol_log", {
        _lead_id: leadId, _event_type: "kol_profile_updated", _entity_type: "professional_profile", _entity_id: leadId,
        _entity_name: "Dados do profissional", _value: null, _channel: "kol",
        _data: { descricao: `Dados atualizados pelo profissional: ${Object.keys(depois).join(", ")}`, antes, depois,
          actor: "kol", dedupe_key: `kol_profile_updated:${leadId}:${Date.now()}` },
      });
      if (logErr) console.error("[professional-course-portal] fn_kol_log profile", logErr.message);
      return json({ ok: true, changed: Object.keys(depois).length });
    }

    // ---- Portal Profissional Parceiro: estatísticas (somente leitura, escopo pelo token) ----

    if (action === "course_stats") {
      // Cursos Smart Dent em colaboração: vínculo direto no curso ou em turmas
      const [{ data: ownCourses }, { data: ownTurmas }] = await Promise.all([
        admin.from("smartops_courses")
          .select("id, title, slug, modality, cover_image_url")
          .eq("instructor_lead_id", leadId),
        admin.from("smartops_course_turmas")
          .select("id, course_id, label, start_date")
          .eq("instructor_lead_id", leadId),
      ]);
      const courseMap = new Map<string, { id: string; title: string; slug: string | null; modality: string; cover_image_url: string | null }>();
      for (const c of ownCourses ?? []) courseMap.set(c.id, c);
      const extraIds = [...new Set((ownTurmas ?? []).map((t) => t.course_id).filter((id) => !courseMap.has(id)))];
      if (extraIds.length) {
        const { data: extra } = await admin.from("smartops_courses")
          .select("id, title, slug, modality, cover_image_url").in("id", extraIds);
        for (const c of extra ?? []) courseMap.set(c.id, c);
      }
      const courseIds = [...courseMap.keys()];
      if (!courseIds.length) return json({ collab_courses: [] });

      const { data: turmas } = await admin.from("smartops_course_turmas")
        .select("id, course_id, label, start_date").in("course_id", courseIds);
      const turmaIds = (turmas ?? []).map((t) => t.id);

      const [enrRes, waitRes, npsRes] = await Promise.all([
        admin.from("smartops_course_enrollments")
          .select("id, course_id, turma_id, status, person_name, lead_id, area_atuacao, especialidade, is_client_smartdent, public_form_payload, equipment_data, enrolled_at")
          .in("course_id", courseIds),
        turmaIds.length
          ? admin.from("smartops_turma_waitlist")
              .select("id, turma_id, person_name, email, phone, created_at")
              .in("turma_id", turmaIds)
          : Promise.resolve({ data: [] as any[] }),
        admin.from("smartops_nps_responses")
          .select("course_id, score_recomendacao, score_satisfacao")
          .in("course_id", courseIds),
      ]);
      const enrollments = enrRes.data ?? [];

      // Contatos dos inscritos (leads canônicos apenas)
      const leadIds = [...new Set(enrollments.map((e) => e.lead_id).filter(Boolean))] as string[];
      const contactMap = new Map<string, { email: string | null; telefone: string | null }>();
      for (let i = 0; i < leadIds.length; i += 200) {
        const { data: leads } = await admin.from("lia_attendances")
          .select("id, email, telefone")
          .in("id", leadIds.slice(i, i + 200))
          .is("merged_into", null);
        for (const l of leads ?? []) contactMap.set(l.id, { email: l.email, telefone: l.telefone });
      }

      // Visualizações: páginas públicas de inscrição do curso
      const viewsMap = new Map<string, number>();
      for (const c of courseMap.values()) {
        if (!c.slug) { viewsMap.set(c.id, 0); continue; }
        const { count } = await admin.from("lead_page_views")
          .select("id", { count: "exact", head: true })
          .ilike("page_path", `%/inscricao/${c.slug}%`);
        viewsMap.set(c.id, count ?? 0);
      }

      const turmaCourse = new Map((turmas ?? []).map((t) => [t.id, t.course_id]));
      const result = courseIds.map((cid) => {
        const enrs = enrollments.filter((e) => e.course_id === cid);
        const confirmed = enrs.filter((e) => !["cancelado", "cancelled", "waitlist", "lista_espera"].includes(String(e.status ?? "").toLowerCase()));
        const waitlist = (waitRes.data ?? []).filter((w) => turmaCourse.get(w.turma_id) === cid);
        const nps = (npsRes.data ?? []).filter((n) => n.course_id === cid);
        const scores = nps.map((n) => n.score_recomendacao).filter((s): s is number => typeof s === "number");

        // Perfil do público: respostas do formulário de inscrição (payload dinâmico)
        const answerCounts = new Map<string, Map<string, number>>();
        const addAnswer = (q: string, v: unknown) => {
          if (typeof v !== "string" || !v.trim() || v.length > 120) return;
          const key = q.trim();
          if (!answerCounts.has(key)) answerCounts.set(key, new Map());
          const m = answerCounts.get(key)!;
          m.set(v.trim(), (m.get(v.trim()) ?? 0) + 1);
        };
        for (const e of enrs) {
          addAnswer("Área de atuação", e.area_atuacao);
          addAnswer("Especialidade", e.especialidade);
          const payload = (e.public_form_payload ?? e.equipment_data) as Record<string, unknown> | null;
          if (payload && typeof payload === "object") {
            for (const [k, v] of Object.entries(payload)) addAnswer(k, v);
          }
        }
        const audience = [...answerCounts.entries()].map(([question, m]) => ({
          question,
          answers: [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
        })).sort((a, b) => b.answers.reduce((s, x) => s + x.count, 0) - a.answers.reduce((s, x) => s + x.count, 0));

        return {
          course: courseMap.get(cid),
          turmas: (turmas ?? []).filter((t) => t.course_id === cid),
          metrics: {
            views: viewsMap.get(cid) ?? 0,
            inscritos: enrs.length,
            confirmados: confirmed.length,
            lista_espera: waitlist.length,
            avaliacoes: scores.length,
            avaliacao_media: scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10 : null,
            clientes_smartdent: enrs.filter((e) => e.is_client_smartdent === true).length,
            nao_clientes: enrs.filter((e) => e.is_client_smartdent !== true).length,
          },
          audience,
          confirmed_list: confirmed.map((e) => ({
            id: e.id,
            nome: e.person_name,
            email: e.lead_id ? contactMap.get(e.lead_id)?.email ?? null : null,
            telefone: e.lead_id ? contactMap.get(e.lead_id)?.telefone ?? null : null,
            area_atuacao: e.area_atuacao,
            especialidade: e.especialidade,
            cliente_smartdent: e.is_client_smartdent === true,
          })),
          waitlist_list: waitlist.map((w) => ({
            id: w.id, nome: w.person_name, email: w.email, telefone: w.phone,
          })),
        };
      });
      return json({ collab_courses: result });
    }

    if (action === "own_course_stats") {
      const { data: courses } = await admin.from("professional_courses")
        .select("id, title, slug, views_count, enrolled_count, credenciamento_form_id")
        .eq("producer_lead_id", leadId);
      const list = courses ?? [];

      // Cursos publicados sem formulário de credenciamento: fallback para cursos
      // publicados antes da geração automática na publicação. A criação/canonicalização
      // dos campos vive em fn_kol_ensure_credenciamento_form (fonte única).
      const { data: publishedAll } = await admin.from("professional_courses")
        .select("id, title, credenciamento_form_id")
        .eq("producer_lead_id", leadId)
        .eq("status", "publicado");
      for (const c of publishedAll ?? []) {
        const hadForm = !!c.credenciamento_form_id;
        const { data: formId, error: fe } = await admin.rpc("fn_kol_ensure_credenciamento_form", { _course_id: c.id });
        if (fe || !formId) { console.error("[portal] ensure form", fe?.message); continue; }
        if (!hadForm) {
          await logCourse(leadId, "kol_course_form_autocreated", { id: c.id, title: c.title }, "Formulário de credenciamento criado automaticamente", true);
          const local = list.find((x) => x.id === c.id);
          if (local) local.credenciamento_form_id = formId;
        }
      }

      const formIds = [...new Set(list.map((c) => c.credenciamento_form_id).filter(Boolean))] as string[];

      const subsByForm = new Map<string, any[]>();
      if (formIds.length) {
        const { data: subs } = await admin.from("lead_form_submissions")
          .select("id, form_id, lead_id, submitted_at")
          .in("form_id", formIds)
          .order("submitted_at", { ascending: false });
        for (const s of subs ?? []) {
          if (!subsByForm.has(s.form_id)) subsByForm.set(s.form_id, []);
          subsByForm.get(s.form_id)!.push(s);
        }
      }
      const subLeadIds = [...new Set([...subsByForm.values()].flat().map((s) => s.lead_id).filter(Boolean))];
      const leadMap = new Map<string, { nome: string | null; email: string | null; telefone: string | null; area_atuacao: string | null; especialidade: string | null }>();
      for (let i = 0; i < subLeadIds.length; i += 200) {
        const { data: leads } = await admin.from("lia_attendances")
          .select("id, nome, email, telefone, area_atuacao, especialidade")
          .in("id", subLeadIds.slice(i, i + 200))
          .is("merged_into", null);
        for (const l of leads ?? []) leadMap.set(l.id, l);
      }

      const courseIds = list.map((c) => c.id);
      const { data: ratings } = courseIds.length
        ? await admin.from("professional_course_ratings").select("course_id, rating").in("course_id", courseIds)
        : { data: [] as any[] };

      return json({
        own_courses: list.map((c) => {
          const subs = c.credenciamento_form_id ? subsByForm.get(c.credenciamento_form_id) ?? [] : [];
          const rs = (ratings ?? []).filter((r) => r.course_id === c.id);
          return {
            course_id: c.id,
            views: c.views_count ?? 0,
            inscritos: subs.length,
            avaliacoes: rs.length,
            avaliacao_media: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null,
            inscritos_list: subs.map((s) => ({
              id: s.id,
              nome: leadMap.get(s.lead_id)?.nome ?? null,
              email: leadMap.get(s.lead_id)?.email ?? null,
              telefone: leadMap.get(s.lead_id)?.telefone ?? null,
              area_atuacao: leadMap.get(s.lead_id)?.area_atuacao ?? null,
              especialidade: leadMap.get(s.lead_id)?.especialidade ?? null,
              data: s.submitted_at,
            })),
          };
        }),
      });
    }

    if (action === "social_stats") {
      const { data: courses } = await admin.from("professional_courses")
        .select("id, title, reels_social_post_id, reels_social_status, reels_social_published_at")
        .eq("producer_lead_id", leadId)
        .not("reels_social_post_id", "is", null);
      const postIds = (courses ?? []).map((c) => c.reels_social_post_id).filter(Boolean);
      if (!postIds.length) return json({ platforms: [], posts: [] });

      const { data: scheduled } = await admin.from("social_scheduled_posts")
        .select("id, social_post_ids, status, published_at")
        .in("id", postIds);
      const socialIds = [...new Set((scheduled ?? []).flatMap((s) => s.social_post_ids ?? []))];
      const { data: posts } = socialIds.length
        ? await admin.from("social_posts")
            .select("id, platform, views, likes, comments, shares, reach, published_at, post_url, thumbnail_url")
            .in("id", socialIds)
        : { data: [] as any[] };

      const byPlatform = new Map<string, { platform: string; posts: number; views: number; likes: number; comments: number; shares: number; reach: number }>();
      for (const p of posts ?? []) {
        const cur = byPlatform.get(p.platform) ?? { platform: p.platform, posts: 0, views: 0, likes: 0, comments: 0, shares: 0, reach: 0 };
        cur.posts += 1;
        cur.views += p.views ?? 0;
        cur.likes += p.likes ?? 0;
        cur.comments += p.comments ?? 0;
        cur.shares += p.shares ?? 0;
        cur.reach += p.reach ?? 0;
        byPlatform.set(p.platform, cur);
      }
      return json({
        platforms: [...byPlatform.values()],
        posts: (posts ?? []).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 30),
      });
    }

    // ---- Transparência da parceria: indicações, vendas, conversão e comissão vigente ----
    if (action === "partnership_stats") {
      const { data: lead } = await admin.from("lia_attendances")
        .select("prof_kol_form_ids, prof_kol_coupons, prof_kol_coupon, prof_kol_commissions")
        .eq("id", leadId).maybeSingle();
      const formRefs: { id: string; name: string }[] = Array.isArray(lead?.prof_kol_form_ids) ? lead.prof_kol_form_ids : [];
      const coupons: { code: string; commission_percent?: number | null; active_from?: string | null; active_to?: string | null }[] =
        Array.isArray(lead?.prof_kol_coupons) ? lead.prof_kol_coupons : [];
      if (!coupons.length && lead?.prof_kol_coupon) coupons.push({ code: String(lead.prof_kol_coupon).toUpperCase() });
      const couponCodes = coupons.map((c) => String(c.code || "").toUpperCase()).filter(Boolean);
      const rules: any[] = Array.isArray(lead?.prof_kol_commissions) ? lead.prof_kol_commissions : [];

      // Indicações: mesma fonte da ficha do profissional (fn_kol_form_leads casa
      // form_name OU a chave do formulário em form_data, resolvendo leads unificados).
      const formNames = formRefs.map((f) => f?.name).filter(Boolean);
      const formIds = formRefs.map((f) => f?.id).filter(Boolean);
      let slugs: string[] = [];
      if (formIds.length) {
        const { data: formRows } = await admin.from("smartops_forms").select("slug").in("id", formIds);
        slugs = (formRows ?? []).map((f: any) => f.slug).filter(Boolean);
      }
      const allNames = [...new Set([...formNames, ...slugs])];
      let leadIds: string[] = [];
      if (allNames.length) {
        const { data: rpcRows } = await admin.rpc("fn_kol_form_leads", { _names: allNames });
        leadIds = [...new Set((rpcRows ?? []).map((r: any) => String(r.lead_id)))];
      }
      let indicacoes: { id: string; nome: string | null; created_at: string }[] = [];
      if (leadIds.length) {
        const { data } = await admin.from("lia_attendances")
          .select("id, nome, created_at")
          .in("id", leadIds).is("merged_into", null)
          .order("created_at", { ascending: false }).limit(500);
        indicacoes = data ?? [];
      }

      // Vendas CRM: negócios ganhos dos leads indicados (mesma regra da ficha)
      let vendas: { origem: string; nome: string | null; valor: number; data: string | null }[] = [];
      let emNegociacao = { quantidade: 0, valor: 0 };
      if (indicacoes.length) {
        const ids2 = indicacoes.map((i) => i.id);
        const { data: deals } = await admin.from("deals")
          .select("lead_id, value, closed_at, status, is_deleted")
          .in("lead_id", ids2);
        const nomeByLead = new Map(indicacoes.map((i) => [i.id, i.nome]));
        for (const d of (deals ?? []).filter((d: any) => !d.is_deleted)) {
          if (d.status === "ganha") {
            vendas.push({ origem: "indicacao", nome: nomeByLead.get(d.lead_id) ?? null, valor: Number(d.value) || 0, data: d.closed_at });
          } else if (d.status === "aberta") {
            emNegociacao.quantidade += 1;
            emNegociacao.valor += Number(d.value) || 0;
          }
        }
      }

      // Vendas por cupom na Loja Integrada (mesma RPC agregada da ficha)
      if (couponCodes.length) {
        for (const code of couponCodes) {
          const { data: cRows } = await admin.rpc("fn_kol_coupon_sales", { _code: code, _from: null, _to: null });
          const r0 = (cRows ?? [])[0] ?? {};
          const receitaCupom = Number(r0.receita) || 0;
          const vendasCupom = Number(r0.vendas) || 0;
          if (vendasCupom > 0) {
            vendas.push({ origem: "cupom", nome: code, valor: receitaCupom, data: null });
          }
        }
      }

      const totalIndicacoes = indicacoes.length;
      const totalVendas = vendas.length;
      const receita = vendas.reduce((s, v) => s + v.valor, 0);
      const seenRules = new Set<string>();
      const activeRules = rules
        .filter((r) => r?.active !== false)
        .map((r) => ({
          produto: String(r.product_name ?? r.category ?? "").trim(),
          percentual: r.percent ?? r.commission_percent ?? null,
          canal: r.channel ?? "cupom",
        }))
        .filter((r) => {
          if (!r.produto) return false;
          const key = `${r.produto}|${r.percentual}|${r.canal}`;
          if (seenRules.has(key)) return false;
          seenRules.add(key);
          return true;
        });
      return json({
        indicacoes: totalIndicacoes,
        vendas: totalVendas,
        receita,
        conversao: totalIndicacoes ? Math.round((totalVendas / totalIndicacoes) * 1000) / 10 : 0,
        em_negociacao: emNegociacao,
        formularios: formRefs.map((f) => f.name).filter(Boolean),
        cupons: couponCodes,
        comissao_vigente: activeRules,
        ultimas_vendas: vendas.sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 20),
      });
    }

    if (action === "log_wa_click") {
      const target = String(body?.target_name ?? "").slice(0, 200);
      const courseId = String(body?.course_id ?? "");
      await admin.rpc("fn_kol_log", {
        _lead_id: leadId, _event_type: "kol_portal_wa_click", _entity_type: "professional_course",
        _entity_id: /^[0-9a-f-]{36}$/i.test(courseId) ? courseId : null,
        _entity_name: target || "Contato WhatsApp", _value: null, _channel: "kol",
        _data: { descricao: `Profissional chamou ${target} no WhatsApp pelo portal`, actor: "kol", dedupe_key: `kol_wa_click:${leadId}:${Date.now()}` },
      });
      return json({ ok: true });
    }

    // ---- Contrato de parceria KOL: leitura, pedido de ajuste e assinatura digital ----

    // ---- Dados do contrato (tipo de pessoa, documento, PIX) ----

    if (action === "contract_data") {
      const { data: contract } = await admin.from("kol_contracts")
        .select("id, number, status, person_type, legal_name, document, pix_key, signed_at")
        .eq("lead_id", leadId).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: lead } = await admin.from("lia_attendances")
        .select("nome, pessoa_cpf, empresa_cnpj").eq("id", leadId).maybeSingle();
      return json({
        contract: contract ?? null,
        fallback: {
          nome: lead?.nome ?? null,
          cpf: lead?.pessoa_cpf ?? null,
          cnpj: lead?.empresa_cnpj ?? null,
        },
      });
    }

    if (action === "save_contract_data") {
      const input = (body?.contract_data ?? {}) as Record<string, unknown>;
      const personType = String(input.person_type ?? "").toUpperCase();
      if (personType !== "PF" && personType !== "PJ") {
        return json({ error: "Selecione o tipo de pessoa (Física ou Jurídica)." }, 400);
      }
      const legalName = String(input.legal_name ?? "").trim();
      if (legalName.length < 3) return json({ error: "Informe o nome completo (legal)." }, 400);
      const doc = String(input.document ?? "").replace(/\D/g, "");
      if (personType === "PF" && doc.length !== 11) return json({ error: "CPF inválido: informe os 11 dígitos." }, 400);
      if (personType === "PJ" && doc.length !== 14) return json({ error: "CNPJ inválido: informe os 14 dígitos." }, 400);
      const pix = String(input.pix_key ?? "").trim();
      if (!pix) return json({ error: "Informe a chave PIX para recebimento das comissões." }, 400);

      const { data: contract } = await admin.from("kol_contracts")
        .select("id, number, status, signed_at").eq("lead_id", leadId).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (contract && (contract.status === "assinado" || contract.signed_at)) {
        return json({ error: "Contrato já assinado. Para alterar dados contratuais, peça um aditivo à equipe." }, 409);
      }
      if (contract) {
        const { error } = await admin.from("kol_contracts")
          .update({
            person_type: personType, legal_name: legalName, document: doc, pix_key: pix,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contract.id);
        if (error) throw error;
      }
      // Espelha o documento no lead para a geração futura do contrato
      const leadUpdate: Record<string, unknown> = personType === "PF"
        ? { pessoa_cpf: doc }
        : { empresa_cnpj: doc };
      const { error: leadErr } = await admin.from("lia_attendances").update(leadUpdate).eq("id", leadId);
      if (leadErr) throw leadErr;
      const { error: logErr } = await admin.rpc("fn_kol_log", {
        _lead_id: leadId, _event_type: "kol_contract_data_saved", _entity_type: "kol_contract",
        _entity_id: contract?.id ?? leadId, _entity_name: contract?.number ?? "Dados contratuais",
        _value: null, _channel: "kol",
        _data: {
          descricao: `Dados contratuais atualizados pelo profissional (${personType})`,
          person_type: personType, legal_name: legalName, actor: "kol",
          dedupe_key: `kol_contract_data:${leadId}:${Date.now()}`,
        },
      });
      if (logErr) console.error("[professional-course-portal] fn_kol_log contract_data", logErr.message);
      return json({ ok: true });
    }

    if (action === "contract") {
      const { data: contract } = await admin.from("kol_contracts")
        .select("id, number, status, body_rendered, signed_at, adjust_notes, pdf_url")
        .eq("lead_id", leadId).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!contract) return json({ contract: null });
      const { data: lead } = await admin.from("lia_attendances")
        .select("prof_kol_commissions").eq("id", leadId).maybeSingle();
      const rules = Array.isArray(lead?.prof_kol_commissions) ? lead.prof_kol_commissions : [];
      const { data: equipment } = await admin.from("kol_equipment_loans")
        .select("product_name, serial_number, status").eq("lead_id", leadId);
      return json({
        contract,
        signed: contract.status === "assinado" || !!contract.signed_at,
        commissions: rules,
        equipment: equipment ?? [],
      });
    }

    if (action === "request_adjust") {
      const note = String(body?.note ?? "").trim();
      if (note.length < 5) return json({ error: "Descreva o ajuste desejado." }, 400);
      const { data: contract } = await admin.from("kol_contracts")
        .select("id, number, status").eq("lead_id", leadId).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!contract) return json({ error: "Nenhum contrato encontrado." }, 404);
      if (contract.status === "assinado") return json({ error: "Contrato já assinado." }, 409);
      const { error } = await admin.from("kol_contracts")
        .update({ status: "ajuste_solicitado", adjust_notes: note, updated_at: new Date().toISOString() })
        .eq("id", contract.id);
      if (error) throw error;
      await admin.rpc("fn_kol_log", {
        _lead_id: leadId, _event_type: "kol_contract_adjust_requested", _entity_type: "kol_contract",
        _entity_id: contract.id, _entity_name: contract.number, _value: null, _channel: "kol",
        _data: { descricao: `Pedido de ajuste no contrato ${contract.number}`, ajuste: note, actor: "kol", dedupe_key: `kol_adjust:${contract.id}:${Date.now()}` },
      });
      return json({ ok: true });
    }

    if (action === "sign_contract") {
      const checks = (body?.checks ?? {}) as Record<string, unknown>;
      if (!checks.contrato || !checks.imagem || !checks.lgpd) {
        return json({ error: "É preciso marcar as três confirmações de leitura antes de assinar." }, 400);
      }
      const { data: contract } = await admin.from("kol_contracts")
        .select("id, number, status, body_rendered, signed_at").eq("lead_id", leadId).is("revoked_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!contract) return json({ error: "Nenhum contrato encontrado." }, 404);
      if (contract.status === "assinado" || contract.signed_at) {
        return json({ error: "Contrato já assinado.", already_signed: true }, 409);
      }
      const { data: prof } = await admin.from("lia_attendances")
        .select("nome, prof_wa_ddi, prof_wa_number, telefone_normalized")
        .eq("id", leadId).maybeSingle();
      const profName = String(prof?.nome ?? "Profissional").trim();

      const now = new Date();
      const signedAt = now.toISOString();
      const validUntil = new Date(now);
      validUntil.setMonth(validUntil.getMonth() + CONTRACT_VALIDITY_MONTHS);
      const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/\//g, "-");

      // Numeração sequencial de KOL por assinatura de contrato
      const { count: signedCount } = await admin.from("kol_contracts")
        .select("id", { count: "exact", head: true })
        .not("signed_at", "is", null).eq("is_test", false);
      const kolSeq = (signedCount ?? 0) + 1;

      // Marca assinatura (hash do texto aceito + metadados)
      const textHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contract.body_rendered ?? ""));
      const textHash = Array.from(new Uint8Array(textHashBuf)).map((x) => x.toString(16).padStart(2, "0")).join("");
      const phoneDigits = String(prof?.prof_wa_number ?? prof?.telefone_normalized ?? "").replace(/\D/g, "");
      const { error: upErr } = await admin.from("kol_contracts").update({
        status: "assinado",
        signed_at: signedAt,
        signed_user_agent: req.headers.get("user-agent") ?? null,
        accepted_text_hash: textHash,
        accepted_phone_last10: phoneDigits.slice(-10) || null,
        acceptance_method: "portal_assinatura_digital",
        image_term_signed_at: signedAt,
        updated_at: signedAt,
      }).eq("id", contract.id).neq("status", "assinado");
      if (upErr) throw upErr;

      // Gera o PDF do contrato assinado
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pageW = 595.28, pageH = 841.89, margin = 56, lineH = 14;
      const maxChars = 88;
      let page = pdf.addPage([pageW, pageH]);
      let y = pageH - margin;
      const newPage = () => { page = pdf.addPage([pageW, pageH]); y = pageH - margin; };
      const drawLine = (text: string, bold = false, size = 10) => {
        if (y < margin + lineH) newPage();
        page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
        y -= lineH;
      };
      drawLine(`CONTRATO DE PARCERIA KOL — ${contract.number}`, true, 13);
      drawLine(`Smart Dent | Fluxo Digital`, false, 10);
      y -= lineH;
      for (const rawLine of String(contract.body_rendered ?? "").split("\n")) {
        let line = rawLine.replace(/\t/g, "  ");
        if (!line.trim()) { y -= lineH / 2; if (y < margin) newPage(); continue; }
        while (line.length > maxChars) {
          let cut = line.lastIndexOf(" ", maxChars);
          if (cut < 30) cut = maxChars;
          drawLine(line.slice(0, cut));
          line = line.slice(cut).trimStart();
        }
        drawLine(line);
      }
      y -= lineH;
      drawLine(`Assinado digitalmente por: ${profName}`, true);
      drawLine(`Data da assinatura: ${fmtDate(now)}   Validade do contrato: ${fmtDate(validUntil)}`);
      drawLine(`Hash do texto aceito: ${textHash.slice(0, 32)}…`);
      const pdfBytes = await pdf.save();

      // Pasta no Drive: "KOL {seq} - {Nome}" dentro da pasta principal de KOLs
      let pdfUrl: string | null = null;
      let driveFolderUrl: string | null = null;
      try {
        const driveToken = await getDriveAccessToken();
        const folderName = sanitizeFolderName(`KOL ${String(kolSeq).padStart(3, "0")} - ${profName}`);
        const folderId = await driveEnsureFolder(driveToken, KOL_DRIVE_PARENT_FOLDER, folderName);
        const pdfName = sanitizeFolderName(`Contrato KOL - ${profName} - ${fmtDate(now)} - Validade ${fmtDate(validUntil)}`) + ".pdf";
        const fileId = await driveUploadFile({
          token: driveToken, folderId, name: pdfName,
          content: new Uint8Array(pdfBytes), mimeType: "application/pdf", overwriteByName: true,
        });
        pdfUrl = await driveGetWebViewLink(driveToken, fileId);
        driveFolderUrl = `https://drive.google.com/drive/folders/${folderId}`;
        await admin.from("kol_contracts").update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() }).eq("id", contract.id);
      } catch (driveErr) {
        // Assinatura já registrada; falha de Drive não pode desfazer o aceite
        console.error("[professional-course-portal] Drive contrato", driveErr);
      }

      await admin.rpc("fn_kol_log", {
        _lead_id: leadId, _event_type: "kol_contract_signed", _entity_type: "kol_contract",
        _entity_id: contract.id, _entity_name: contract.number, _value: null, _channel: "kol",
        _data: {
          descricao: `Contrato ${contract.number} assinado digitalmente pelo portal`,
          kol_seq: kolSeq, pdf_url: pdfUrl, drive_folder: driveFolderUrl,
          validade: validUntil.toISOString(), actor: "kol",
          dedupe_key: `kol_signed:${contract.id}`,
        },
      });
      return json({ ok: true, signed_at: signedAt, pdf_url: pdfUrl, drive_folder_url: driveFolderUrl, kol_seq: kolSeq });
    }

    // ---- Performance da parceria (mesma lógica da ficha do profissional, com filtro de período) ----
    if (action === "performance") {
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.from ?? "")) ? String(body.from) : null;
      const to = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.to ?? "")) ? String(body.to) : null;
      return json(await kolPerformance(admin, leadId, from, to));
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[professional-course-portal]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});