// Normaliza `deal.activities` do PipeRun em eventos `crm_activity` no lead_activity_log.
// Regras: dedupe por activity.id (entity_id), timestamp real da atividade (nunca now()).
// NÃO altera schema de lead_activity_log — dedupe é feito por leitura prévia.

export type PiperunActivity = Record<string, unknown>;

const TYPE_BY_ACTIVITY_TYPE_ID: Record<string, string> = {
  "54382": "ligacao",
  "54383": "email",
  "54384": "reuniao",
  "54385": "tarefa",
  "54386": "tarefa",
  "54387": "whatsapp",
  "251552": "whatsapp",
  "268785": "ligacao",
};

const KIND_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  whatsapp: "WhatsApp",
  nota: "Nota",
  tarefa: "Tarefa",
};

const KIND_ICON: Record<string, string> = {
  ligacao: "📞",
  email: "✉️",
  reuniao: "🤝",
  whatsapp: "💬",
  nota: "🗒️",
  tarefa: "✅",
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function stripHtml(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const clean = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean : null;
}

export function classifyActivity(a: PiperunActivity): string {
  const byId = TYPE_BY_ACTIVITY_TYPE_ID[String(a.activity_type_id ?? "")];
  const title = (str(a.title) || "").toLowerCase();
  if (/whats|wpp|zap/.test(title)) return "whatsapp";
  if (/liga(ç|c)|call|telefone/.test(title)) return "ligacao";
  if (/reuni(ã|a)o|meeting|visita|demo/.test(title)) return "reuniao";
  if (/e-?mail/.test(title)) return "email";
  if (byId) return byId;
  return "tarefa";
}

export function activityTimestamp(a: PiperunActivity): string | null {
  const candidates = [a.date_start, a.start_at, a.internal_date, a.created_at, a.delivery_date, a.updated_at];
  for (const c of candidates) {
    const s = str(c);
    if (!s) continue;
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export interface NormalizedActivityRow {
  lead_id: string;
  event_type: "crm_activity";
  entity_type: "piperun_activity";
  entity_id: string;
  entity_name: string | null;
  event_timestamp: string;
  source_channel: "crm";
  event_data: Record<string, unknown>;
}

/** Converte a lista bruta em rows prontas para insert (sem dedupe contra o banco). */
export function normalizePiperunActivities(leadId: string, activities: unknown): NormalizedActivityRow[] {
  if (!Array.isArray(activities)) return [];
  const rows: NormalizedActivityRow[] = [];
  const seen = new Set<string>();
  for (const raw of activities) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as PiperunActivity;
    const id = str(a.id);
    if (!id || seen.has(id)) continue;
    const ts = activityTimestamp(a);
    if (!ts) continue;
    seen.add(id);
    const kind = classifyActivity(a);
    const owner = (a.user as Record<string, unknown> | undefined)?.name;
    const done = String(a.status ?? "") === "5" || String(a.status ?? "") === "3";
    rows.push({
      lead_id: leadId,
      event_type: "crm_activity",
      entity_type: "piperun_activity",
      entity_id: id,
      entity_name: str(a.title),
      event_timestamp: ts,
      source_channel: "crm",
      event_data: {
        kind,
        kind_label: KIND_LABEL[kind] || "Atividade",
        icon: KIND_ICON[kind] || "🗒️",
        title: str(a.title),
        comment: stripHtml(a.comment) || stripHtml(a.description),
        owner: str(owner),
        deal_id: a.deal_id != null ? Number(a.deal_id) : null,
        activity_type_id: a.activity_type_id != null ? Number(a.activity_type_id) : null,
        status: a.status ?? null,
        concluida: done,
        duration: a.duration ?? null,
        fonte: "piperun",
      },
    });
  }
  return rows;
}

/** Insere na lead_activity_log apenas atividades ainda não registradas para o lead. */
export async function syncPiperunActivitiesToTimeline(
  supabase: { from: (t: string) => any },
  leadId: string,
  activities: unknown,
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const rows = normalizePiperunActivities(leadId, activities);
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const { data: existing, error: readErr } = await supabase
    .from("lead_activity_log")
    .select("entity_id")
    .eq("lead_id", leadId)
    .eq("event_type", "crm_activity")
    .in("entity_id", rows.map((r) => r.entity_id));
  if (readErr) return { inserted: 0, skipped: rows.length, error: readErr.message };

  const have = new Set(((existing || []) as { entity_id: string }[]).map((r) => String(r.entity_id)));
  const toInsert = rows.filter((r) => !have.has(r.entity_id));
  if (toInsert.length === 0) return { inserted: 0, skipped: rows.length };

  const { error } = await supabase.from("lead_activity_log").insert(toInsert);
  if (error) return { inserted: 0, skipped: rows.length, error: error.message };
  return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
}
