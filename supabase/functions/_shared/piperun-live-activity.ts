/**
 * Atividade "Live agendada" no PipeRun.
 * ------------------------------------
 * Regra fixa (definida pelo comercial):
 *   Tipo: Live agendada · Status: Planejada (status=0)
 *   Data/Hora: data e hora da demonstração que o lead agendou
 *   Duração: 60 minutos · Lembrete: 5 minutos antes
 *   Responsável: dono atual do deal (vendedor)
 *
 * NÃO move, fecha nem altera deals — apenas cria a atividade.
 */

import { piperunGet, piperunPost } from "./piperun-field-map.ts";

export const LIVE_ACTIVITY_TYPE_NAME = "Live agendada";
export const LIVE_ACTIVITY_TYPE_ID_FALLBACK = 271012;
export const LIVE_ACTIVITY_DURATION_MIN = 60;
export const LIVE_ACTIVITY_REMINDER_MIN = 5;

type Sb = { from: (t: string) => any };

/** Resolve o id do tipo de atividade "Live agendada" (fallback: constante). */
export async function resolveLiveActivityTypeId(apiToken: string): Promise<number> {
  try {
    const res = await piperunGet(apiToken, "activityTypes", { show: 200 });
    const list = (res.data as { data?: Array<Record<string, unknown>> } | null)?.data ?? [];
    const hit = list.find(
      (t) => String(t.name ?? "").trim().toLowerCase() === LIVE_ACTIVITY_TYPE_NAME.toLowerCase(),
    );
    const id = Number(hit?.id);
    if (Number.isFinite(id) && id > 0) return id;
  } catch (e) {
    console.warn("[live-activity] activityTypes lookup falhou:", e);
  }
  return LIVE_ACTIVITY_TYPE_ID_FALLBACK;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" + "HH:mm[:ss]" → "YYYY-MM-DD HH:mm:ss" (+minutos opcionais). */
export function piperunDateTime(date: string, time: string, addMinutes = 0): string {
  const [h, m] = time.split(":").map((v) => Number(v) || 0);
  const total = h * 60 + m + addMinutes;
  const dayShift = Math.floor(total / (24 * 60));
  const rest = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  let d = date;
  if (dayShift !== 0) {
    const base = new Date(`${date}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dayShift);
    d = base.toISOString().slice(0, 10);
  }
  return `${d} ${pad(Math.floor(rest / 60))}:${pad(rest % 60)}:00`;
}

export interface LiveSchedule {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  source: string;
}

/**
 * Data/hora que o lead agendou: 1º dia da turma (`smartops_turma_days`),
 * senão `start_date`/`launch_date`, senão data no rótulo (dd/mm/aaaa).
 */
export async function resolveLiveSchedule(
  supabase: Sb,
  turmaId: string,
): Promise<LiveSchedule | null> {
  const { data: days } = await supabase
    .from("smartops_turma_days")
    .select("date, start_time, day_number")
    .eq("turma_id", turmaId)
    .order("day_number", { ascending: true })
    .limit(1);
  const day = days?.[0];
  if (day?.date) {
    return {
      date: String(day.date).slice(0, 10),
      time: String(day.start_time ?? "19:00").slice(0, 5),
      source: "turma_days",
    };
  }

  const { data: turma } = await supabase
    .from("smartops_course_turmas")
    .select("label, start_date, launch_date")
    .eq("id", turmaId)
    .maybeSingle();
  if (!turma) return null;

  const raw = turma.start_date ?? turma.launch_date;
  if (raw) return { date: String(raw).slice(0, 10), time: "19:00", source: "turma_start_date" };

  const m = String(turma.label ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { date: `${m[3]}-${m[2]}-${m[1]}`, time: "19:00", source: "turma_label" };
  return null;
}

export interface CreateLiveActivityInput {
  apiToken: string;
  dealId: number;
  ownerId?: number | null;
  schedule: LiveSchedule;
  title?: string;
  description?: string;
}

export async function createLiveScheduledActivity(
  input: CreateLiveActivityInput,
): Promise<{ ok: boolean; activity_id?: number; error?: string; payload: Record<string, unknown> }> {
  const typeId = await resolveLiveActivityTypeId(input.apiToken);
  const startAt = piperunDateTime(input.schedule.date, input.schedule.time);
  const endAt = piperunDateTime(input.schedule.date, input.schedule.time, LIVE_ACTIVITY_DURATION_MIN);

  const payload: Record<string, unknown> = {
    title: input.title ?? LIVE_ACTIVITY_TYPE_NAME,
    activity_type_id: typeId,
    deal_id: input.dealId,
    status: 0, // Planejada
    start_at: startAt,
    end_at: endAt,
    duration: LIVE_ACTIVITY_DURATION_MIN,
    // Lembrete 5 minutos antes (o PipeRun aceita variações de nome do campo).
    alert: 1,
    alert_time: LIVE_ACTIVITY_REMINDER_MIN,
    reminder: LIVE_ACTIVITY_REMINDER_MIN,
    notification_time: LIVE_ACTIVITY_REMINDER_MIN,
    description: input.description ?? "",
  };
  if (Number.isFinite(Number(input.ownerId)) && Number(input.ownerId) > 0) {
    payload.owner_id = Number(input.ownerId);
  }

  const res = await piperunPost(input.apiToken, "activities", payload);
  const activityId = Number((res.data as { data?: { id?: unknown } } | null)?.data?.id);
  if (res.success && Number.isFinite(activityId)) {
    return { ok: true, activity_id: activityId, payload };
  }
  return { ok: false, error: JSON.stringify(res.data).slice(0, 400), payload };
}
