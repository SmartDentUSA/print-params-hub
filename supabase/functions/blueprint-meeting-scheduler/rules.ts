// Regras puras do agendamento Blueprint (sem rede) — testadas em rules_test.ts.

export const VENDAS_PIPELINE_ID = 18784;
export const APRESENTACAO_STAGE_ID = 99295;
export const MEET_LINK_FIELD_ID = 800593;
export const MEETING_ACTIVITY_TYPE_ID = 54384;
export const DEFAULT_DURATION_MIN = 60;
export const PROCESSING_STALE_MS = 5 * 60 * 1000;

export type MeetingStatus =
  | "processing" | "pending_schedule" | "created" | "failed";

export interface Slot { startIso: string; endIso: string; activityId: number | null; source: string }

/** PipeRun devolve "YYYY-MM-DD HH:MM:SS" no horário de Brasília. */
export function piperunLocalToIso(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3] ?? "00"}-03:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Escolhe a reunião do PipeRun: atividade de reunião (tipo ou título) não concluída,
 * com início; prefere a próxima futura, senão a mais recente. Nunca inventa horário.
 */
export function pickMeetingSlot(activities: unknown, now = new Date()): Slot | null {
  if (!Array.isArray(activities)) return null;
  const cands: Slot[] = [];
  for (const raw of activities) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const isMeeting = Number(a.activity_type_id) === MEETING_ACTIVITY_TYPE_ID ||
      /reuni(ã|a)o|apresenta|visita|demo|meet/i.test(String(a.title ?? ""));
    if (!isMeeting) continue;
    if (Number(a.status) === 2) continue; // concluída
    const start = piperunLocalToIso(a.start_at ?? a.date_start);
    if (!start) continue;
    let end = piperunLocalToIso(a.end_at ?? a.date_end);
    const dur = Number(a.duration) > 0 ? Number(a.duration) : DEFAULT_DURATION_MIN;
    if (!end || new Date(end) <= new Date(start)) {
      end = new Date(new Date(start).getTime() + dur * 60000).toISOString();
    }
    cands.push({ startIso: start, endIso: end, activityId: a.id != null ? Number(a.id) : null, source: "piperun_activity" });
  }
  if (!cands.length) return null;
  const t = now.getTime();
  const future = cands.filter((c) => new Date(c.endIso).getTime() >= t)
    .sort((x, y) => x.startIso.localeCompare(y.startIso));
  if (future.length) return future[0];
  return cands.sort((x, y) => y.startIso.localeCompare(x.startIso))[0];
}

/** ID determinístico do evento no Google Calendar (base32hex: 0-9 a-v). */
export function calendarEventId(dealId: number | string): string {
  return `sdmeet${String(dealId).replace(/\D/g, "")}`;
}

export function meetCodeFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? "").match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return m ? m[1].toLowerCase() : null;
}

export function existingMeetLink(customFields: unknown): string | null {
  if (!Array.isArray(customFields)) return null;
  for (const c of customFields) {
    const r = c as Record<string, unknown>;
    if (Number(r.id ?? r.custom_field_id) !== MEET_LINK_FIELD_ID) continue;
    const v = String(r.value ?? r.raw_value ?? "").trim();
    if (meetCodeFromUrl(v)) return v;
  }
  return null;
}

/** Decide o que fazer com a linha de estado já existente. */
export function claimDecision(
  status: MeetingStatus | null | undefined,
  updatedAt: string | null | undefined,
  now = new Date(),
): "take" | "busy" | "done" {
  if (!status) return "take";
  if (status === "created") return "done";
  if (status === "processing") {
    const age = now.getTime() - new Date(updatedAt ?? 0).getTime();
    return age < PROCESSING_STALE_MS ? "busy" : "take";
  }
  return "take"; // failed / pending_schedule → nova tentativa
}

const v = (x: unknown) => {
  const s = x == null ? "" : String(x).trim();
  return s && s.toLowerCase() !== "null" ? s : null;
};

const fmtBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
};

export interface DossierInput {
  lead: Record<string, unknown> | null;
  deal: { id: number | string; title?: string | null; origin?: string | null; ownerName?: string | null; value?: number | null };
  history: Array<Record<string, unknown>>;
  activities: Array<{ title?: string | null; when?: string | null; comment?: string | null }>;
  meetUrl: string | null;
  slot: Slot | null;
}

/** Nota de preparação. Só mostra campos que existem — nada é inventado. */
export function buildDossierNote(i: DossierInput): string {
  const L = i.lead ?? {};
  const lines: string[] = [];
  const add = (label: string, val: unknown) => { const s = v(val); if (s) lines.push(`• ${label}: ${s}`); };
  lines.push("📋 Preparação para Apresentação · Blueprint Intelligence");
  lines.push("");
  lines.push(i.meetUrl ? `🎥 Google Meet: ${i.meetUrl}` : "🎥 Google Meet: aguardando data/hora da reunião no PipeRun");
  if (i.slot) lines.push(`🗓️ Horário: ${fmtBR(i.slot.startIso)}`);
  lines.push("");
  lines.push("👤 Cliente");
  add("Nome", L.nome);
  add("Empresa", L.empresa_nome);
  add("Cidade", [v(L.cidade), v(L.uf)].filter(Boolean).join("/"));
  add("Área de atuação", L.area_atuacao);
  add("Especialidade", L.especialidade);
  add("Produto de interesse", v(L.produto_interesse) ?? v(L.produto_interesse_auto));
  add("Scanner atual", L.equip_scanner);
  add("Impressora atual", L.equip_impressora);
  add("Origem", v(i.deal.origin) ?? v(L.origem_primeiro_contato));
  add("No sistema desde", fmtBR(v(L.created_at)));
  add("Vendedor responsável", i.deal.ownerName);
  const hist = i.history.filter((h) => String(h.piperun_deal_id) !== String(i.deal.id));
  if (hist.length) {
    lines.push("");
    lines.push(`💼 Histórico comercial (${hist.length} negócio(s) anteriores)`);
    for (const h of hist.slice(0, 6)) {
      const parts = [fmtBR(v(h.piperun_created_at))?.split(" ")[0], `#${h.piperun_deal_id}`, v(h.pipeline_name), v(h.stage_name), v(h.status), v(h.owner_name), v(h.product), v(h.loss_reason) ? `motivo: ${v(h.loss_reason)}` : null].filter(Boolean);
      lines.push(`• ${parts.join(" · ")}`);
    }
  }
  const acts = i.activities.filter((a) => v(a.title) || v(a.comment)).slice(0, 5);
  if (acts.length) {
    lines.push("");
    lines.push("🗒️ Atividades recentes");
    for (const a of acts) {
      const c = v(a.comment)?.slice(0, 220);
      lines.push(`• ${[fmtBR(v(a.when))?.split(" ")[0], v(a.title), c].filter(Boolean).join(" · ")}`);
    }
  }
  const resumo = v(L.resumo_historico_ia);
  if (resumo) { lines.push(""); lines.push("🧠 Resumo já registrado no sistema"); lines.push(resumo.slice(0, 700)); }
  return lines.join("\n");
}
