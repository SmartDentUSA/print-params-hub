import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSessionId } from "@/hooks/usePageTracking";
import { currentClickOrigin, type AnyClickOrigin } from "@/lib/clickOrigin";

export type AttendanceChannel = "form" | "specialist" | "whatsapp_lia";

/** Form identity, not hostname, connects an embedded attendance visit to its metrics. */
export function trackAttendanceView(formId: string | null) {
  if (!formId) return;
  try {
    const query = new URLSearchParams(window.location.search);
    void supabase.from("lead_page_views" as any).insert({
      session_id: getOrCreateSessionId(),
      page_path: window.location.pathname,
      page_type: "form",
      page_title: document.title,
      referrer: document.referrer || null,
      utm_source: query.get("utm_source"),
      utm_medium: query.get("utm_medium"),
      utm_campaign: query.get("utm_campaign"),
      utm_term: query.get("utm_term"),
      extra_data: { form_id: formId, action: "view", channel: "whatsapp_lia", source_host: window.location.hostname },
    } as any).then(({ error }) => {
      if (error) console.warn("[AttendanceTracking]", error.message);
    });
  } catch { /* Analytics must never prevent attendance. */ }
}

function sessionId() {
  let id = sessionStorage.getItem("sd_attendance_session");
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("sd_attendance_session", id);
  }
  return id;
}

/** Registra visualização/clique/abertura/lead de um canal de atendimento (fire-and-forget). */
export function trackAttendanceEvent(e: {
  channel: AttendanceChannel;
  event_type: "view" | "click" | "open" | "lead";
  form_id?: string | null;
  campaign_slug?: string | null;
  product_name?: string | null;
  lead_id?: string | null;
  /** Simulador de WhatsApp que originou o evento (ex.: item da landing). */
  simulator_id?: string | null;
  /** Origem do clique (e-mail, SMS...); padrão: lida da URL atual. */
  origin?: AnyClickOrigin | null;
}) {
  let origin = e.origin ?? null;
  if (e.origin === undefined) {
    origin = currentClickOrigin();
  }
  void (supabase as any).from("attendance_channel_events").insert({
    channel: e.channel,
    event_type: e.event_type,
    form_id: e.form_id ?? null,
    campaign_slug: e.campaign_slug ?? null,
    product_name: e.product_name ?? null,
    lead_id: e.lead_id ?? null,
    ...(e.simulator_id ? { simulator_id: e.simulator_id.slice(0, 80) } : {}),
    ...(origin ? { origin_channel: origin } : {}),
    session_id: sessionId(),
    page_path: window.location.pathname.slice(0, 300),
  }).then(() => {}, () => {});
}

export function buildLiaUrl(opts: {
  formId?: string | null;
  campaign?: string | null;
  product?: string | null;
  /** Produto do catálogo já escolhido (validado no servidor). */
  productId?: string | null;
  /** Botão do formulário já escolhido (validado no servidor). */
  interest?: string | null;
  /** Identificador do simulador no comparativo por canal. */
  simulator?: string | null;
  base?: string;
}) {
  const u = new URL("/embed/dra-lia", opts.base ?? window.location.origin);
  if (opts.formId) u.searchParams.set("form", opts.formId);
  if (opts.campaign) u.searchParams.set("c", opts.campaign);
  if (opts.product) u.searchParams.set("p", opts.product);
  if (opts.productId) u.searchParams.set("pid", opts.productId);
  if (opts.interest) u.searchParams.set("i", opts.interest);
  if (opts.simulator) u.searchParams.set("sim", opts.simulator);
  return u.toString();
}
