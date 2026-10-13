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

const BUCKET = "knowledge-images";

type Caller = { kind: "staff"; userId: string } | { kind: "kol"; leadId: string } | { kind: "blocked"; until: string } | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAIL_WINDOW_MS = 15 * 60_000;
const FAIL_LIMIT = 5;
const BLOCK_MS = 60 * 60_000;

async function sha(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const clientIp = (req: Request) =>
  (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

/** Resolve o código público do palestrante (slug) para o id interno. UUID só é aceito para a equipe. */
async function idFromRef(ref: string, allowUuid: boolean): Promise<string> {
  const r = String(ref || "").trim();
  if (!r) return "";
  if (UUID_RE.test(r)) return allowUuid ? r : "";
  if (!/^[a-z0-9]{6,32}$/i.test(r)) return "";
  const { data } = await admin.from("lia_attendances").select("id").eq("prof_public_slug", r).is("merged_into", null).maybeSingle();
  return data?.id ?? "";
}

/** Garante slug público para os ids informados; devolve mapa id -> slug. */
async function slugsFor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids.filter((i) => UUID_RE.test(i)))];
  if (!uniq.length) return out;
  const { data } = await admin.from("lia_attendances").select("id, prof_public_slug").in("id", uniq);
  for (const r of data ?? []) {
    let slug = r.prof_public_slug as string | null;
    if (!slug) {
      slug = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await admin.from("lia_attendances").update({ prof_public_slug: slug }).eq("id", r.id);
    }
    out.set(r.id, slug);
  }
  return out;
}

/** Sessão válida: usuário interno (JWT + papel) ou KOL (token do portal ligado ao celular). */
async function resolveCaller(req: Request, body: any): Promise<Caller> {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await admin.auth.getClaims(jwt).catch(() => ({ data: null } as any));
    const uid = data?.claims?.sub as string | undefined;
    if (uid) {
      const { data: ok } = await admin.rpc("fn_is_internal_staff", { _user_id: uid });
      if (ok === true) return { kind: "staff", userId: uid };
    }
  }
  const token = String(body?.kol_token ?? "");
  if (token.length >= 12 && token.length <= 128) {
    const { data } = await admin
      .from("professional_portal_tokens")
      .select("lead_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (data && !data.revoked_at && (!data.expires_at || new Date(data.expires_at).getTime() > Date.now())) {
      const { data: lead } = await admin
        .from("lia_attendances")
        .select("id, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
        .eq("id", data.lead_id)
        .is("merged_into", null)
        .maybeSingle();
      const raw = lead ? `${lead.prof_wa_ddi ?? ""}${lead.prof_wa_number ?? ""}` || lead.wa_phone || lead.telefone_normalized : "";
      if (lead && String(raw ?? "").replace(/\D/g, "").length >= 10) return { kind: "kol", leadId: lead.id };
    }
  }
  // KOL pelo celular: o celular informado precisa bater (últimos 10 dígitos) com o do cadastro
  const phoneKey = String(body?.kol_phone ?? "").replace(/\D/g, "").slice(-10);
  const pid = await idFromRef(String(body?.professional_ref ?? body?.professional_id ?? ""), false);
  if (phoneKey.length === 10 && pid) {
    const ipHash = await sha(`kol:${clientIp(req)}`);
    const nowIso = new Date().toISOString();
    const { data: blocks } = await admin.from("kol_portal_attempts").select("blocked_until")
      .or(`professional_id.eq.${pid},ip_hash.eq.${ipHash}`).gt("blocked_until", nowIso)
      .order("blocked_until", { ascending: false }).limit(1);
    if (blocks?.[0]) return { kind: "blocked", until: blocks[0].blocked_until };
    const { data: lead } = await admin
      .from("lia_attendances")
      .select("id, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
      .eq("id", pid)
      .is("merged_into", null)
      .maybeSingle();
    if (lead) {
      const keys = [`${lead.prof_wa_ddi ?? ""}${lead.prof_wa_number ?? ""}`, lead.wa_phone, lead.telefone_normalized]
        .map((v) => String(v ?? "").replace(/\D/g, "").slice(-10))
        .filter((k) => k.length === 10);
      if (keys.includes(phoneKey)) {
        await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: true });
        await kolLog(lead.id, "kol_portal_login", "", null, {
          descricao: "Acesso à agenda com celular verificado",
          metodo: "celular", celular_verificado: true,
          dedupe_key: `kol_portal_login:${lead.id}:${nowIso.slice(0, 13)}`,
        }, null, "kol");
        return { kind: "kol", leadId: lead.id };
      }
    }
    // Celular errado: registra tentativa e bloqueia após 5 erros em 15 min (por profissional ou IP)
    const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString();
    await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false });
    const [{ count: byPid }, { count: byIp }] = await Promise.all([
      admin.from("kol_portal_attempts").select("id", { count: "exact", head: true }).eq("professional_id", pid).eq("success", false).gte("created_at", since),
      admin.from("kol_portal_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("success", false).gte("created_at", since),
    ]);
    const blocked = (byPid ?? 0) >= FAIL_LIMIT || (byIp ?? 0) >= FAIL_LIMIT;
    let until: string | null = null;
    if (blocked) {
      until = new Date(Date.now() + BLOCK_MS).toISOString();
      await admin.from("kol_portal_attempts").insert({ professional_id: pid, ip_hash: ipHash, success: false, blocked_until: until });
    }
    await kolLog(pid, "kol_portal_login_failed", "", null, {
      descricao: blocked ? "Acesso à agenda bloqueado por 1 hora (celular incorreto)" : "Tentativa de acesso com celular incorreto",
      tentativas_15min: Math.max(byPid ?? 0, byIp ?? 0), bloqueado_ate: until,
      dedupe_key: `kol_login_failed:${pid}:${Date.now()}`,
    }, null, "kol");
    if (blocked) return { kind: "blocked", until: until! };
  }
  return null;
}

async function kolLog(leadId: string, eventType: string, entityId: string, entityName: string | null, data: Record<string, unknown>, value: number | null, actor: string) {
  const { error } = await admin.rpc("fn_kol_log", {
    _lead_id: leadId, _event_type: eventType, _entity_type: entityId ? "smartops_event" : "kol_portal", _entity_id: entityId || null,
    _entity_name: entityName, _data: { ...data, actor }, _value: value, _channel: "kol",
  });
  if (error) console.error("[event-speaker-booking] fn_kol_log", eventType, error.message);
}

const actorOf = (c: Caller) => (c?.kind === "staff" ? `equipe:${c.userId}` : "kol");

type Session = { date?: string; start_time?: string; end_time?: string; theme?: string };
type Speaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  professional_id?: string;
  sessions?: Session[];
  support_sessions?: Session[];
};

const handleOf = (v?: string | null) =>
  String(v || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const normName = (v?: string | null) =>
  String(v || "").trim().replace(/\s+/g, " ").toLowerCase();

const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function eventDays(start: string | null, end: string | null, daysCount: number | null): string[] {
  if (!start) return [];
  const out: string[] = [];
  const [y, mo, d] = start.slice(0, 10).split("-").map(Number);
  const first = Date.UTC(y, mo - 1, d);
  let total = 1;
  if (end) {
    const [ey, emo, ed] = end.slice(0, 10).split("-").map(Number);
    total = Math.max(1, Math.round((Date.UTC(ey, emo - 1, ed) - first) / 86400000) + 1);
  } else {
    total = Math.max(1, Number(daysCount) || 1);
  }
  for (let i = 0; i < Math.min(total, 15); i++) {
    const dt = new Date(first + i * 86400000);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

async function loadEvent(eventId: string) {
  const { data, error } = await admin
    .from("smartops_events")
    .select("id, name, location, company_stand, start_date, end_date, start_time, end_time, days_count, event_logo_url, instagram_handle, speakers")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

async function publicSpeakers(speakers: Speaker[], isStaff: boolean) {
  const slugs = await slugsFor((speakers || []).map((s) => s.professional_id || ""));
  return (speakers || []).map((s) => ({
    name: s.name || "",
    instagram: s.instagram || "",
    theme: s.theme || "",
    photo_url: s.photo_url || "",
    ...(isStaff ? { professional_id: s.professional_id || "" } : {}),
    speaker_slug: s.professional_id ? slugs.get(s.professional_id) || "" : "",
    sessions: (s.sessions || []).filter((x) => x?.date && x?.start_time),
    support_sessions: (s.support_sessions || []).filter((x) => x?.date && x?.start_time),
  }));
}

async function uploadPhoto(eventId: string, base64: string, ext: string) {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 6_000_000) throw new Error("Foto muito grande (máx. 6 MB).");
  const safeExt = /^(png|jpg|jpeg|webp)$/i.test(ext) ? ext.toLowerCase() : "jpg";
  const path = `event-speakers/${eventId}/${crypto.randomUUID()}.${safeExt}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Lista de profissionais liberados (mesma fonte do card de Profissionais em Cursos) */
async function listProfessionals() {
  const { data, error } = await admin
    .from("lia_attendances")
    .select("id, nome, email, especialidade, prof_cro, prof_photo_url, prof_mini_cv, instagram, prof_updated_at, prof_public_slug")
    .is("merged_into", null)
    .not("prof_photo_url", "is", null)
    .order("prof_updated_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return (data ?? [])
    .filter((p: any) => String(p.nome || "").trim().length > 2)
    .map((p: any) => ({
      id: p.id,
      slug: p.prof_public_slug || "",
      name: String(p.nome).trim(),
      instagram: p.instagram ? `@${handleOf(p.instagram)}` : "",
      photo_url: p.prof_photo_url || "",
      specialty: p.especialidade || "",
      cro: p.prof_cro || "",
      mini_bio: p.prof_mini_cv || "",
    }));
}

/**
 * Registra na timeline do lead (palestrante/KOL) a participação no evento:
 * quantas palestras deu, quanto tempo palestrou e quanto tempo ficou
 * disponível para apoio do time comercial. Um único evento por lead+evento,
 * sempre atualizado (idempotente).
 */
async function logSpeakerEngagement(
  event: any,
  professionalId: string,
  demos: Session[],
  support: Session[],
) {
  if (!professionalId) return;
  const minutesOf = (list: Session[]) =>
    list.reduce((sum, s) => {
      const toMin = (t?: string) => {
        const [h, m] = String(t || "").slice(0, 5).split(":").map(Number);
        return Number.isFinite(h) ? h * 60 + (m || 0) : null;
      };
      const st = toMin(s.start_time);
      if (st === null) return sum;
      const en = toMin(s.end_time) ?? st + 60;
      return sum + Math.max(0, en - st);
    }, 0);

  const demoMinutes = minutesOf(demos);
  const supportMinutes = minutesOf(support);
  const eventTs = event.start_date
    ? new Date(`${String(event.start_date).slice(0, 10)}T12:00:00Z`).toISOString()
    : new Date().toISOString();

  const row = {
    lead_id: professionalId,
    event_type: "event_participation",
    entity_type: "smartops_event",
    entity_id: String(event.id),
    entity_name: event.name ?? null,
    event_timestamp: eventTs,
    source_channel: "evento",
    value_numeric: Number(((demoMinutes + supportMinutes) / 60).toFixed(2)),
    duration_seconds: (demoMinutes + supportMinutes) * 60,
    event_data: {
      kind: "evento",
      kind_label: "Participação em evento",
      icon: "🎤",
      evento: event.name ?? null,
      local: event.location ?? null,
      estande: event.company_stand ?? null,
      data_inicio: event.start_date ?? null,
      data_fim: event.end_date ?? null,
      palestras_qtd: demos.length,
      palestras_minutos: demoMinutes,
      palestras_horas: Number((demoMinutes / 60).toFixed(2)),
      palestras: demos.map((s) => ({
        data: s.date,
        inicio: s.start_time,
        fim: s.end_time,
        tema: s.theme ?? null,
      })),
      apoio_comercial_qtd: support.length,
      apoio_comercial_minutos: supportMinutes,
      apoio_comercial_horas: Number((supportMinutes / 60).toFixed(2)),
      apoio_comercial: support.map((s) => ({ data: s.date, inicio: s.start_time, fim: s.end_time })),
      fonte: "smartops_agenda_kol",
      dedupe_key: `event_participation:${event.id}:${professionalId}`,
    },
  };

  try {
    const { data: existing } = await admin
      .from("lead_activity_log")
      .select("id")
      .eq("lead_id", professionalId)
      .eq("event_type", "event_participation")
      .eq("entity_id", String(event.id))
      .limit(1);
    if (existing?.[0]?.id) {
      await admin.from("lead_activity_log").update(row).eq("id", existing[0].id);
    } else {
      await admin.from("lead_activity_log").insert(row);
    }
  } catch (e) {
    console.error("[event-speaker-booking] engagement log", e);
  }
}

/** Versão pública da lista: sem id interno, e-mail ou CRO; o id vira o slug público. */
async function publicPros(list: Awaited<ReturnType<typeof listProfessionals>>) {
  const missing = list.filter((p) => !p.slug).map((p) => p.id);
  const extra = await slugsFor(missing);
  return list.map((p) => ({
    id: p.slug || extra.get(p.id) || "",
    name: p.name, instagram: p.instagram, photo_url: p.photo_url, specialty: p.specialty, cro: "", mini_bio: p.mini_bio,
  })).filter((p) => p.id);
}

const slotKey = (kind: "palestra" | "estande", s: Session) => `${kind}|${s.date}|${String(s.start_time).slice(0, 5)}`;
const fmtBR = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Avisa o dono da agenda (WhatsApp do CS) quando ela é alterada pelo link público. */
async function notifyOwner(event: any, leadId: string, resumo: string) {
  try {
    const { data: lead } = await admin.from("lia_attendances")
      .select("nome, prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized")
      .eq("id", leadId).is("merged_into", null).maybeSingle();
    if (!lead) return;
    const raw = (lead.prof_wa_number ? `${lead.prof_wa_ddi || "55"}${lead.prof_wa_number}` : "") || lead.wa_phone || lead.telefone_normalized || "";
    let to = String(raw).replace(/\D/g, "");
    if (to.length === 10 || to.length === 11) to = "55" + to;
    if (to.length < 12) return;
    const instance = Deno.env.get("CS_EVOLUTION_INSTANCE") || "cs_principal";
    const { data: cs } = await admin.from("team_members").select("id").eq("evolution_instance_name", instance).maybeSingle();
    if (!cs) return;
    const first = String(lead.nome || "").trim().split(" ")[0];
    const message = `Olá${first ? `, ${first}` : ""}! Sua agenda do evento ${event.name ?? ""} foi alterada.\n\n${resumo}\n\nSe não foi você, responda esta mensagem para avisar a equipe Smart Dent.`;
    const { error } = await admin.functions.invoke("smart-ops-wa-send", {
      body: { to, message, lead_id: leadId, team_member_id: cs.id, source: "kol_agenda_alterada", metadata: { event_id: event.id } },
    });
    if (error) console.error("[event-speaker-booking] notifyOwner", error.message);
  } catch (e) {
    console.error("[event-speaker-booking] notifyOwner", e);
  }
}

/** Marca como cancelados os horários informados (linhas kol_talk/kol_stand) e registra kol_schedule_cancelled. */
async function cancelSlots(event: any, pid: string, talks: Session[], stands: Session[], actor: string) {
  if (!pid || (!talks.length && !stands.length)) return;
  const keys = [
    ...talks.map((s) => `kol_talk:${event.id}:${pid}:${s.date}:${String(s.start_time).slice(0, 5)}`),
    ...stands.map((s) => `kol_stand:${event.id}:${pid}:${s.date}:${String(s.start_time).slice(0, 5)}`),
  ];
  const { data: rows } = await admin.from("lead_activity_log").select("id, event_data")
    .eq("lead_id", pid).in("event_type", ["kol_talk_scheduled", "kol_stand_scheduled"]).eq("entity_id", String(event.id));
  const now = new Date().toISOString();
  for (const r of rows ?? []) {
    if (!keys.includes(String((r.event_data as any)?.dedupe_key ?? ""))) continue;
    await admin.from("lead_activity_log")
      .update({ event_data: { ...(r.event_data ?? {}), status: "cancelado", cancelado_em: now } }).eq("id", r.id);
  }
  const n = talks.length + stands.length;
  await kolLog(pid, "kol_schedule_cancelled", String(event.id), event.name ?? null, {
    descricao: `${n} horário${n === 1 ? "" : "s"} cancelado${n === 1 ? "" : "s"} · ${event.name ?? ""}`,
    evento: event.name ?? null,
    palestras: talks, apoio_comercial: stands, status: "cancelado",
    dedupe_key: `kol_cancel:${event.id}:${pid}:${Date.now()}`,
  }, null, actor);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const eventId = String(body?.event_id ?? "");

    // A agenda pública e a TV usam esta ação para substituir a foto salva no
    // evento pela foto mais recente do cadastro de Profissionais. Ela não
    // pertence a um evento específico e, portanto, não exige event_id.
    const caller = await resolveCaller(req, body);
    const isStaff = caller?.kind === "staff";
    if (caller?.kind === "blocked") {
      return json({ error: "Muitas tentativas com celular incorreto. Acesso bloqueado por 1 hora.", blocked_until: caller.until }, 429);
    }

    // Fotos públicas dos palestrantes já presentes na agenda/TV (só nome, foto e Instagram)
    if (action === "speaker_photos") {
      const ids = new Set((Array.isArray(body?.ids) ? body.ids : []).slice(0, 80).map(String));
      for (const sl of (Array.isArray(body?.slugs) ? body.slugs : []).slice(0, 80)) {
        const id = await idFromRef(String(sl), false);
        if (id) ids.add(id);
      }
      const names = new Set((Array.isArray(body?.names) ? body.names : []).slice(0, 80).map((n: unknown) => normName(String(n))));
      const all = await listProfessionals();
      return json({
        professionals: all
          .filter((p) => ids.has(p.id) || names.has(normName(p.name)))
          .map((p) => ({ ...(isStaff ? { id: p.id } : {}), slug: p.slug, name: p.name, photo_url: p.photo_url, instagram: p.instagram })),
      });
    }

    if (action === "professionals") {
      if (!isStaff) return json({ error: "unauthorized" }, 401);
      return json({ professionals: await listProfessionals() });
    }

    if (!eventId) return json({ error: "event_id obrigatório" }, 400);

    const event = await loadEvent(eventId);
    if (!event) return json({ error: "not_found" }, 404);

    const days = eventDays(event.start_date, event.end_date, event.days_count);

    if (action === "bootstrap") {
      return json({
        event: {
          id: event.id,
          name: event.name,
          location: event.location,
          company_stand: event.company_stand,
          start_date: event.start_date,
          end_date: event.end_date,
          start_time: event.start_time,
          end_time: event.end_time,
          event_logo_url: event.event_logo_url,
          instagram_handle: event.instagram_handle,
        },
        days,
        speakers: await publicSpeakers((event.speakers || []) as Speaker[], isStaff),
        professionals: isStaff
          ? await listProfessionals()
          : await publicPros((await listProfessionals()).filter((p) => caller?.kind !== "kol" || p.id === caller.leadId)),
        session: caller
          ? { kind: caller.kind, lead_id: caller.kind === "kol" ? (await slugsFor([caller.leadId])).get(caller.leadId) ?? null : null }
          : null,
      });
    }

    if (action === "create_professional") {
      if (!isStaff) return json({ error: "unauthorized" }, 401);
      const name = String(body?.name ?? "").trim();
      if (name.length < 3) return json({ error: "Informe o nome completo do palestrante." }, 400);
      const email = String(body?.email ?? "").trim().toLowerCase() || null;
      const igHandle = handleOf(body?.instagram);
      const specialty = String(body?.specialty ?? "").trim() || null;
      const areaAtuacao = String(body?.area_atuacao ?? "").trim() || null;
      const cro = String(body?.cro ?? "").trim() || null;
      const miniBio = String(body?.mini_bio ?? "").trim() || null;
      const coursePlatform = String(body?.course_platform ?? "").trim() || null;
      const birth = String(body?.birth_date ?? "").trim();
      const waDdi = String(body?.wa_ddi ?? "").replace(/\D/g, "") || null;
      const waNumber = String(body?.wa_number ?? "").replace(/\D/g, "") || null;
      const phone = waNumber ? `${waDdi ?? "55"}${waNumber}` : null;

      let photoUrl = typeof body?.photo_url === "string" ? body.photo_url : "";
      if (typeof body?.photo_base64 === "string" && body.photo_base64.length > 100) {
        photoUrl = await uploadPhoto(eventId, body.photo_base64, String(body?.photo_ext ?? "jpg"));
      }

      // Reaproveita cadastro existente (email ou nome) — nunca duplica pessoa
      let existing: any = null;
      if (email) {
        const { data } = await admin
          .from("lia_attendances")
          .select("*")
          .ilike("email", email)
          .is("merged_into", null)
          .limit(1);
        existing = data?.[0] ?? null;
      }
      if (!existing) {
        const { data } = await admin
          .from("lia_attendances")
          .select("*")
          .ilike("nome", name)
          .is("merged_into", null)
          .limit(1);
        existing = data?.[0] ?? null;
      }

      const fields: Record<string, unknown> = {
        nome: name,
        especialidade: specialty,
        prof_cro: cro,
        prof_mini_cv: miniBio,
        prof_updated_at: new Date().toISOString(),
      };
      if (areaAtuacao) fields.area_atuacao = areaAtuacao;
      if (coursePlatform) fields.prof_course_platform = coursePlatform;
      if (/^\d{4}-\d{2}-\d{2}$/.test(birth)) fields.pessoa_nascimento = birth;
      if (waNumber) { fields.prof_wa_ddi = waDdi ?? "55"; fields.prof_wa_number = waNumber; }
      if (email) fields.email = email;
      if (phone) {
        const norm = `+${phone}`;
        fields.telefone_raw = norm;
        fields.telefone_normalized = norm;
        fields.wa_phone = phone;
      }
      if (igHandle) fields.instagram = `@${igHandle}`;
      if (photoUrl) fields.prof_photo_url = photoUrl;

      let professionalId: string;
      if (existing) {
        // Cadastro existente: nunca sobrescreve; só preenche campos vazios e registra antes/depois
        const empty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
        const patch: Record<string, unknown> = {};
        const antes: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (k === "prof_updated_at" || empty(v)) continue;
          if (empty(existing[k])) { patch[k] = v; antes[k] = existing[k] ?? null; }
        }
        // celular é um bloco: só entra se o cadastro não tiver nenhum celular
        const hasPhone = !empty(existing.prof_wa_number) || !empty(existing.wa_phone) || !empty(existing.telefone_normalized);
        if (hasPhone) for (const k of ["prof_wa_ddi", "prof_wa_number", "wa_phone", "telefone_raw", "telefone_normalized"]) { delete patch[k]; delete antes[k]; }
        if (Object.keys(patch).length) {
          patch.prof_updated_at = new Date().toISOString();
          const { error } = await admin.from("lia_attendances").update(patch).eq("id", existing.id);
          if (error) throw error;
          const depois = { ...patch }; delete depois.prof_updated_at;
          await kolLog(existing.id, "kol_profile_update", String(event.id), event.name ?? null, {
            descricao: `Cadastro complementado pela agenda do evento (${Object.keys(depois).length} campo(s) vazio(s))`,
            antes, depois, origem: "agenda_kol_evento",
            dedupe_key: `kol_profile_fill:${existing.id}:${Date.now()}`,
          }, null, actorOf(caller));
        }
        professionalId = existing.id;
      } else {
        const { data, error } = await admin
          .from("lia_attendances")
          .insert({
            ...fields,
            lead_status: "novo",
            origem_primeiro_contato: "smartops_agenda_kol_evento",
          })
          .select("id")
          .single();
        if (error) throw error;
        professionalId = data.id;
      }

      return json({
        ok: true,
        professional: {
          id: professionalId,
          name,
          instagram: igHandle ? `@${igHandle}` : "",
          photo_url: photoUrl || "",
          specialty: specialty || "",
          cro: cro || "",
          mini_bio: miniBio || "",
        },
        professionals: await listProfessionals(),
      });
    }

    if ((action === "book" || action === "release") && !caller) {
      return json({ error: "Celular não confere com o cadastro do profissional. Confira o número ou fale com a equipe." }, 401);
    }

    if (action === "book") {
      const name = String(body?.name ?? "").trim();
      const instagram = handleOf(body?.instagram);
      let professionalId = caller?.kind === "kol"
        ? caller.leadId
        : await idFromRef(String(body?.professional_ref ?? body?.professional_id ?? ""), true);
      const rawSlots = Array.isArray(body?.slots) ? body.slots : [];
      const rawSupport = Array.isArray(body?.support_slots) ? body.support_slots : [];

      if (name.length < 3) return json({ error: "Selecione o palestrante." }, 400);
      if (!rawSlots.length && !rawSupport.length) {
        return json({ error: "Selecione pelo menos um horário." }, 400);
      }
      if (rawSlots.length > 12) return json({ error: "Máximo de 12 horários por palestrante." }, 400);
      if (rawSupport.length > 60) return json({ error: "Máximo de 60 horários de apoio." }, 400);

      const slots: Session[] = [];
      for (const s of rawSlots) {
        const date = String(s?.date ?? "");
        const start = String(s?.start_time ?? "");
        const theme = String(s?.theme ?? "").trim();
        if (!isDate(date) || !isTime(start)) return json({ error: "Horário inválido." }, 400);
        if (days.length && !days.includes(date)) return json({ error: "Data fora do período do evento." }, 400);
        const [, mi] = start.split(":").map(Number);
        if (mi !== 0) return json({ error: "Os horários são de 1 em 1 hora." }, 400);
        if (theme.length < 3) return json({ error: "Informe o tema de cada horário." }, 400);
        const dur = Number(s?.duration_minutes ?? 60);
        if (!Number.isFinite(dur) || dur < 30 || dur > 240 || dur % 30 !== 0) {
          return json({ error: "A duração deve ser de 30 em 30 minutos (30 a 240)." }, 400);
        }
        slots.push({ date, start_time: start, end_time: addMinutes(start, dur), theme });
      }


      const supportSlots: Session[] = [];
      for (const s of rawSupport) {
        const date = String(s?.date ?? "");
        const start = String(s?.start_time ?? "");
        if (!isDate(date) || !isTime(start)) return json({ error: "Horário de apoio inválido." }, 400);
        if (days.length && !days.includes(date)) return json({ error: "Data de apoio fora do período do evento." }, 400);
        const [, mi] = start.split(":").map(Number);
        if (mi !== 0) return json({ error: "Os horários de apoio são de 1 em 1 hora." }, 400);
        // Apoio comercial NÃO é bloqueante: vários KOLs podem estar no estande
        // no mesmo horário, e o horário de palestra também pode ser marcado.
        if (!supportSlots.some((d) => d.date === date && d.start_time === start)) {
          supportSlots.push({ date, start_time: start, end_time: addMinutes(start, 60) });
        }
      }

      const list = ((event.speakers || []) as Speaker[]).map((s) => ({ ...s }));
      const idx = list.findIndex((s) =>
        (professionalId && s.professional_id === professionalId) ||
        (instagram && handleOf(s.instagram) === instagram) ||
        (!instagram && !professionalId && normName(s.name) === normName(name))
      );

      // Conflito: janela ocupada por OUTRO palestrante, respeitando o
      // intervalo obrigatório de 1 hora entre demonstrações.
      const GAP_MIN = 60;
      const toMin = (t?: string) => {
        const [h, m] = String(t || "").slice(0, 5).split(":").map(Number);
        return Number.isFinite(h) ? h * 60 + (m || 0) : null;
      };
      const busy: { date: string; start: number; end: number }[] = [];
      list.forEach((s, i) => {
        if (i === idx) return;
        for (const ses of s.sessions || []) {
          const st = toMin(ses?.start_time);
          if (!ses?.date || st === null) continue;
          busy.push({ date: String(ses.date).slice(0, 10), start: st, end: toMin(ses?.end_time) ?? st + 60 });
        }
      });
      const conflict = slots.find((s) => {
        const st = toMin(s.start_time)!;
        const en = toMin(s.end_time) ?? st + 60;
        return busy.some((b) => b.date === s.date && st < b.end + GAP_MIN && en + GAP_MIN > b.start);
      });
      if (conflict) {
        return json(
          {
            error: `O horário ${conflict.start_time} do dia ${conflict.date} não está disponível (é preciso 1 hora de intervalo entre demonstrações). Atualize a página.`,
          },
          409,
        );
      }

      // Intervalo de 1 hora também entre as próprias demonstrações
      const own = [...slots].sort((a, b) =>
        `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`),
      );
      for (let i = 1; i < own.length; i++) {
        const prev = own[i - 1];
        const cur = own[i];
        if (prev.date !== cur.date) continue;
        const prevEnd = toMin(prev.end_time) ?? toMin(prev.start_time)! + 60;
        if (toMin(cur.start_time)! < prevEnd + GAP_MIN) {
          return json(
            { error: `Deixe 1 hora de intervalo entre suas demonstrações (${prev.start_time} e ${cur.start_time}).` },
            400,
          );
        }
      }


      let photoUrl = typeof body?.photo_url === "string" ? body.photo_url : "";
      if (typeof body?.photo_base64 === "string" && body.photo_base64.length > 100) {
        photoUrl = await uploadPhoto(eventId, body.photo_base64, String(body?.photo_ext ?? "jpg"));
      }

      const entry: Speaker = {
        ...(idx >= 0 ? list[idx] : {}),
        name,
        instagram: instagram ? `@${instagram}` : (idx >= 0 ? list[idx].instagram || "" : ""),
        theme: slots[0]?.theme || (idx >= 0 ? list[idx].theme || "" : ""),
        photo_url: photoUrl || (idx >= 0 ? list[idx].photo_url || "" : ""),
        professional_id: professionalId || (idx >= 0 ? list[idx].professional_id || "" : ""),
        sessions: slots,
        support_sessions: supportSlots,
      };
      const prevTalks = idx >= 0 ? (list[idx].sessions || []) : [];
      const prevStands = idx >= 0 ? (list[idx].support_sessions || []) : [];
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);

      const { error } = await admin.from("smartops_events").update({ speakers: list }).eq("id", eventId);
      if (error) throw error;

      await logSpeakerEngagement(event, entry.professional_id || "", slots, supportSlots);
      const newKeys = new Set([...slots.map((x) => slotKey("palestra", x)), ...supportSlots.map((x) => slotKey("estande", x))]);
      const removedTalks = prevTalks.filter((x) => x?.date && x?.start_time && !newKeys.has(slotKey("palestra", x)));
      const removedStands = prevStands.filter((x) => x?.date && x?.start_time && !newKeys.has(slotKey("estande", x)));
      await cancelSlots(event, entry.professional_id || "", removedTalks, removedStands, actorOf(caller));
      if (caller?.kind === "kol" && entry.professional_id) {
        const linhas = [
          ...slots.map((x) => `• Palestra ${fmtBR(x.date)} ${x.start_time}–${x.end_time}`),
          ...supportSlots.map((x) => `• Estande ${fmtBR(x.date)} ${x.start_time}–${x.end_time}`),
        ];
        const canc = removedTalks.length + removedStands.length;
        await notifyOwner(event, entry.professional_id, `Horários ativos:\n${linhas.join("\n") || "nenhum"}${canc ? `\n\n${canc} horário(s) cancelado(s).` : ""}`);
      }
      if (entry.professional_id) {
        for (const s of slots) {
          await kolLog(entry.professional_id, "kol_talk_scheduled", String(event.id), event.name ?? null, {
            descricao: `Palestra ${s.start_time}-${s.end_time} · ${event.name ?? ""}`.trim(),
            evento: event.name ?? null, data: s.date, inicio: s.start_time, fim: s.end_time, tema: s.theme ?? null,
            status: "agendado", event_timestamp: `${s.date}T${s.start_time}:00-03:00`,
            dedupe_key: `kol_talk:${event.id}:${entry.professional_id}:${s.date}:${s.start_time}`,
          }, null, actorOf(caller));
        }
        for (const s of supportSlots) {
          await kolLog(entry.professional_id, "kol_stand_scheduled", String(event.id), event.name ?? null, {
            descricao: `Estande ${s.start_time}-${s.end_time} · ${event.name ?? ""}`.trim(),
            evento: event.name ?? null, estande: event.company_stand ?? null, data: s.date, inicio: s.start_time, fim: s.end_time,
            status: "agendado", event_timestamp: `${s.date}T${s.start_time}:00-03:00`,
            dedupe_key: `kol_stand:${event.id}:${entry.professional_id}:${s.date}:${s.start_time}`,
          }, null, actorOf(caller));
        }
      }

      return json({ ok: true, speakers: await publicSpeakers(list, isStaff) });
    }

    if (action === "release") {
      const instagram = handleOf(body?.instagram);
      const name = String(body?.name ?? "").trim();
      const professionalId = caller?.kind === "kol"
        ? caller.leadId
        : await idFromRef(String(body?.professional_ref ?? body?.professional_id ?? ""), true);
      const matches = (s: Speaker) =>
        (professionalId && s.professional_id === professionalId) ||
        (instagram && handleOf(s.instagram) === instagram) ||
        (!instagram && !professionalId && normName(s.name) === normName(name));
      const all = (event.speakers || []) as Speaker[];
      const released = all.find(matches);
      if (!released) return json({ error: "not_found" }, 404);
      const pid = professionalId || released.professional_id || "";

      // Lista opcional de horários: [{ date, start_time, type: "palestra" | "estande" }]
      const rawSel = Array.isArray(body?.slots) ? body.slots : [];
      const sel = new Set<string>();
      for (const x of rawSel.slice(0, 80)) {
        const type = x?.type === "estande" ? "estande" : x?.type === "palestra" ? "palestra" : "";
        if (!type || !isDate(x?.date) || !isTime(String(x?.start_time ?? "").slice(0, 5))) {
          return json({ error: "Horário inválido para cancelamento (data, início e tipo palestra/estande)." }, 400);
        }
        sel.add(`${type}|${x.date}|${String(x.start_time).slice(0, 5)}`);
      }
      const talks = (released.sessions || []).filter((x) => x?.date && x?.start_time);
      const stands = (released.support_sessions || []).filter((x) => x?.date && x?.start_time);
      const cancelAll = sel.size === 0;
      const cTalks = cancelAll ? talks : talks.filter((x) => sel.has(slotKey("palestra", x)));
      const cStands = cancelAll ? stands : stands.filter((x) => sel.has(slotKey("estande", x)));
      if (!cancelAll && cTalks.length + cStands.length === 0) return json({ error: "Nenhum dos horários informados está na agenda." }, 404);
      const keepTalks = talks.filter((x) => !cTalks.includes(x));
      const keepStands = stands.filter((x) => !cStands.includes(x));

      const list = (keepTalks.length || keepStands.length)
        ? all.map((s) => (s === released ? { ...s, sessions: keepTalks, support_sessions: keepStands } : s))
        : all.filter((s) => s !== released);
      const { error } = await admin.from("smartops_events").update({ speakers: list }).eq("id", eventId);
      if (error) throw error;

      if (pid) {
        await cancelSlots(event, pid, cTalks, cStands, actorOf(caller));
        if (keepTalks.length || keepStands.length) {
          // Recalcula horas da participação só com os horários ativos
          await logSpeakerEngagement(event, pid, keepTalks, keepStands);
        } else {
          const { data: rows } = await admin.from("lead_activity_log").select("id, event_data")
            .eq("lead_id", pid).eq("event_type", "event_participation").eq("entity_id", eventId);
          for (const r of rows ?? []) {
            await admin.from("lead_activity_log")
              .update({ event_data: { ...(r.event_data ?? {}), status: "cancelado", cancelado_em: new Date().toISOString() } })
              .eq("id", r.id);
          }
        }
        if (caller?.kind === "kol") {
          const linhas = [
            ...cTalks.map((x) => `• Palestra ${fmtBR(x.date)} ${x.start_time} cancelada`),
            ...cStands.map((x) => `• Estande ${fmtBR(x.date)} ${x.start_time} cancelado`),
          ];
          await notifyOwner(event, pid, linhas.join("\n"));
        }
      }
      return json({ ok: true, speakers: await publicSpeakers(list, isStaff) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[event-speaker-booking]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
