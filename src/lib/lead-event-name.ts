export interface CaptureEvent {
  id: string;
  name: string;
  slug: string | null;
}

export interface CaptureForm {
  id: string;
  name: string;
  event_id: string | null;
}

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Resolve only explicit event/form references or an unambiguous origin match. */
export function resolveCaptureEventName(
  record: Record<string, unknown>, events: CaptureEvent[], forms: CaptureForm[],
): string | null {
  const linked = events.find((event) => event.id === text(record.event_id));
  if (linked) return linked.name;
  const sources = [record.form_name, record.origem_campanha, record.origem_primeiro_contato,
    record.source_reference, record.source, record.original_source].map(text).filter(Boolean);
  const form = forms.find((item) => item.id === text(record.form_id)
    || sources.some((source) => normalize(source) === normalize(item.name)));
  const formEvent = events.find((event) => event.id === form?.event_id);
  if (formEvent) return formEvent.name;
  const explicitName = text(record.event_name) || text(record.evento_nome);
  if (explicitName && !/^(evento|congresso)$/i.test(explicitName)) return explicitName;
  const matches = events.filter((event) => [event.name, event.slug].some((alias) => {
    const key = normalize(alias || "");
    return key.length >= 4 && sources.some((source) => ` ${normalize(source)} `.includes(` ${key} `));
  }));
  return matches.length === 1 ? matches[0].name : null;
}