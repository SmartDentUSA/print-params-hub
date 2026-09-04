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

type Session = { date?: string; start_time?: string; end_time?: string; theme?: string };
type Speaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  professional_id?: string;
  sessions?: Session[];
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
    .select("id, name, location, company_stand, start_date, end_date, days_count, event_logo_url, instagram_handle, speakers")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

function publicSpeakers(speakers: Speaker[]) {
  return (speakers || []).map((s) => ({
    name: s.name || "",
    instagram: s.instagram || "",
    theme: s.theme || "",
    photo_url: s.photo_url || "",
    professional_id: s.professional_id || "",
    sessions: (s.sessions || []).filter((x) => x?.date && x?.start_time),
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
    .select("id, nome, email, especialidade, prof_cro, prof_photo_url, prof_mini_cv, instagram, prof_updated_at")
    .not("prof_updated_at", "is", null)
    .is("merged_into", null)
    .order("nome", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? [])
    .filter((p: any) => String(p.nome || "").trim().length > 2)
    .map((p: any) => ({
      id: p.id,
      name: String(p.nome).trim(),
      instagram: p.instagram ? `@${handleOf(p.instagram)}` : "",
      photo_url: p.prof_photo_url || "",
      specialty: p.especialidade || "",
      cro: p.prof_cro || "",
      mini_bio: p.prof_mini_cv || "",
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const eventId = String(body?.event_id ?? "");
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
          event_logo_url: event.event_logo_url,
          instagram_handle: event.instagram_handle,
        },
        days,
        speakers: publicSpeakers((event.speakers || []) as Speaker[]),
        professionals: await listProfessionals(),
      });
    }

    if (action === "professionals") {
      return json({ professionals: await listProfessionals() });
    }

    if (action === "create_professional") {
      const name = String(body?.name ?? "").trim();
      if (name.length < 3) return json({ error: "Informe o nome completo do palestrante." }, 400);
      const email = String(body?.email ?? "").trim().toLowerCase() || null;
      const igHandle = handleOf(body?.instagram);
      const specialty = String(body?.specialty ?? "").trim() || null;
      const cro = String(body?.cro ?? "").trim() || null;
      const miniBio = String(body?.mini_bio ?? "").trim() || null;
      const phone = String(body?.phone ?? "").replace(/\D/g, "") || null;

      let photoUrl = typeof body?.photo_url === "string" ? body.photo_url : "";
      if (typeof body?.photo_base64 === "string" && body.photo_base64.length > 100) {
        photoUrl = await uploadPhoto(eventId, body.photo_base64, String(body?.photo_ext ?? "jpg"));
      }

      // Reaproveita cadastro existente (email ou nome) — nunca duplica pessoa
      let existing: any = null;
      if (email) {
        const { data } = await admin
          .from("lia_attendances")
          .select("id, nome")
          .ilike("email", email)
          .is("merged_into", null)
          .limit(1);
        existing = data?.[0] ?? null;
      }
      if (!existing) {
        const { data } = await admin
          .from("lia_attendances")
          .select("id, nome")
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
      if (email) fields.email = email;
      if (phone) fields.telefone = phone;
      if (igHandle) fields.instagram = `@${igHandle}`;
      if (photoUrl) fields.prof_photo_url = photoUrl;

      let professionalId: string;
      if (existing) {
        const { error } = await admin.from("lia_attendances").update(fields).eq("id", existing.id);
        if (error) throw error;
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

    if (action === "book") {
      const name = String(body?.name ?? "").trim();
      const instagram = handleOf(body?.instagram);
      const professionalId = String(body?.professional_id ?? "").trim();
      const rawSlots = Array.isArray(body?.slots) ? body.slots : [];

      if (name.length < 3) return json({ error: "Selecione o palestrante." }, 400);
      if (!rawSlots.length) return json({ error: "Selecione pelo menos um horário." }, 400);
      if (rawSlots.length > 12) return json({ error: "Máximo de 12 horários por palestrante." }, 400);

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
        slots.push({ date, start_time: start, end_time: addMinutes(start, 60), theme });
      }

      const list = ((event.speakers || []) as Speaker[]).map((s) => ({ ...s }));
      const idx = list.findIndex((s) =>
        (professionalId && s.professional_id === professionalId) ||
        (instagram && handleOf(s.instagram) === instagram) ||
        (!instagram && !professionalId && normName(s.name) === normName(name))
      );

      // Conflito: janela já ocupada por OUTRO palestrante (checa sobreposição real)
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
        return busy.some((b) => b.date === s.date && st < b.end && st + 60 > b.start);
      });
      if (conflict) {
        return json(
          { error: `O horário ${conflict.start_time} do dia ${conflict.date} já foi reservado. Atualize a página.` },
          409,
        );
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
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);

      const { error } = await admin.from("smartops_events").update({ speakers: list }).eq("id", eventId);
      if (error) throw error;

      return json({ ok: true, speakers: publicSpeakers(list) });
    }

    if (action === "release") {
      const instagram = handleOf(body?.instagram);
      const name = String(body?.name ?? "").trim();
      const professionalId = String(body?.professional_id ?? "").trim();
      const list = ((event.speakers || []) as Speaker[]).filter((s) =>
        !((professionalId && s.professional_id === professionalId) ||
          (instagram && handleOf(s.instagram) === instagram) ||
          (!instagram && !professionalId && normName(s.name) === normName(name)))
      );
      const { error } = await admin.from("smartops_events").update({ speakers: list }).eq("id", eventId);
      if (error) throw error;
      return json({ ok: true, speakers: publicSpeakers(list) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[event-speaker-booking]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
