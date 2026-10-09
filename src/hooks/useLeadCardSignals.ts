import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadCardSignals {
  lives: number;
  lastWonAt: string | null;
  /** Data (start_date da turma) do treinamento/imersão mais recente do lead. */
  lastTrainingAt: string | null;
}

// Batches card requests (one query per ~60ms window) to avoid N requests per board.
const cache = new Map<string, LeadCardSignals>();
const listeners = new Map<string, Set<(s: LeadCardSignals) => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const ids = Array.from(pending);
  pending = new Set();
  timer = null;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [enr, won] = await Promise.all([
      supabase.from("smartops_course_enrollments").select("lead_id, turma_id, status").in("lead_id", chunk),
      supabase.from("deals").select("lead_id, closed_at").in("lead_id", chunk).eq("status", "ganha"),
    ]);
    const result = new Map<string, LeadCardSignals>(chunk.map((id) => [id, { lives: 0, lastWonAt: null, lastTrainingAt: null }]));
    const enrollments = (enr.data ?? []) as { lead_id: string; turma_id: string | null; status: string | null }[];
    for (const r of enrollments) {
      const s = result.get(r.lead_id);
      if (s) s.lives += 1;
    }
    // Treinamento (Imersão): inscrição confirmada/agendada com turma datada.
    const turmaIds = [...new Set(enrollments.filter((e) => e.turma_id && e.status !== "cancelado").map((e) => e.turma_id!))];
    if (turmaIds.length > 0) {
      const { data: turmas } = await supabase.from("smartops_course_turmas").select("id, start_date").in("id", turmaIds);
      const turmaDate = new Map(((turmas ?? []) as { id: string; start_date: string | null }[]).map((t) => [t.id, t.start_date]));
      for (const e of enrollments) {
        if (!e.turma_id || e.status === "cancelado") continue;
        const d = turmaDate.get(e.turma_id);
        const s = result.get(e.lead_id);
        if (s && d && (!s.lastTrainingAt || d > s.lastTrainingAt)) s.lastTrainingAt = d;
      }
    }
    for (const r of (won.data ?? []) as { lead_id: string; closed_at: string | null }[]) {
      const s = result.get(r.lead_id);
      if (s && r.closed_at && (!s.lastWonAt || r.closed_at > s.lastWonAt)) s.lastWonAt = r.closed_at;
    }
    result.forEach((s, id) => {
      cache.set(id, s);
      listeners.get(id)?.forEach((fn) => fn(s));
    });
  }
}

export function useLeadCardSignals(leadId: string): LeadCardSignals | null {
  const [signals, setSignals] = useState<LeadCardSignals | null>(cache.get(leadId) ?? null);
  useEffect(() => {
    if (cache.has(leadId)) { setSignals(cache.get(leadId)!); return; }
    const set = listeners.get(leadId) ?? new Set();
    set.add(setSignals);
    listeners.set(leadId, set);
    pending.add(leadId);
    if (!timer) timer = setTimeout(flush, 60);
    return () => { set.delete(setSignals); };
  }, [leadId]);
  return signals;
}

export type ClientDot = "nao_cliente" | "verde" | "amarelo" | "vermelho";

/** Verde: compra nos últimos 3 meses; amarelo: 3 a 9 meses; vermelho: mais de 9 meses. */
export function resolveClientDot(lastPurchase: string | null, isClient: boolean, now = Date.now()): ClientDot {
  if (!lastPurchase) return isClient ? "vermelho" : "nao_cliente";
  const t = new Date(lastPurchase).getTime();
  if (Number.isNaN(t)) return isClient ? "vermelho" : "nao_cliente";
  const months = (now - t) / (1000 * 60 * 60 * 24 * 30.4375);
  if (months <= 3) return "verde";
  if (months <= 9) return "amarelo";
  return "vermelho";
}

/** Rótulo "MM/AAAA" do treinamento mais recente (ex.: 10/2026). */
export function formatTrainingMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function latestDate(dates: Array<unknown>): string | null {
  let best: number | null = null;
  for (const d of dates) {
    if (!d || typeof d !== "string") continue;
    const t = new Date(d).getTime();
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}
