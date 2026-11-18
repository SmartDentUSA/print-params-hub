// Cópia de src/lib/campaignEngagementFilters.ts (envio de e-mails no servidor). Manter iguais.
// Usa junções do PostgREST sobre lia_attendances, sem alterar o lead nem tirar ninguém de listas:
//  - campaign_send_log (envios por lead): recebeu, abriu/leu, clicou, não entregue;
//  - lead_activity_log (form_submission): converteu no formulário em qualquer momento.

export type EngagementAction =
  | "recebeu" | "nao_recebeu" | "abriu" | "recebeu_nao_abriu"
  | "clicou" | "recebeu_nao_clicou" | "nao_entregue";

/** any_email | any_wa | id de campaigns */
export type EngagementCampaign = string;

export const ENGAGEMENT_ACTIONS: { v: EngagementAction; l: string }[] = [
  { v: "recebeu", l: "Recebeu" },
  { v: "nao_recebeu", l: "Não recebeu" },
  { v: "abriu", l: "Abriu o e-mail / leu o WhatsApp" },
  { v: "recebeu_nao_abriu", l: "Recebeu e não abriu / não leu" },
  { v: "clicou", l: "Clicou no link do e-mail" },
  { v: "recebeu_nao_clicou", l: "Recebeu e não clicou" },
  { v: "nao_entregue", l: "Não entregue (recusado / erro)" },
];

const ENG = "eng";
const CONV = "conv";

// deno-lint-ignore no-explicit-any
function addEmbed(q: any, alias: string, table: string, join: "!inner" | "!left"): void {
  const url: URL | undefined = q?.url;
  if (!url?.searchParams) return;
  const current = url.searchParams.get("select") || "id";
  if (!current.includes(`${alias}:`)) url.searchParams.set("select", `${current},${alias}:${table}${join}(lead_id)`);
}

// deno-lint-ignore no-explicit-any
export function applyEngagementFilters<Q>(q: Q, f: Record<string, any>): Q {
  // deno-lint-ignore no-explicit-any
  let qq: any = q;
  const camp = String(f?.eng_campanha ?? "");
  const acao = String(f?.eng_acao ?? "") as EngagementAction;
  if (camp && ENGAGEMENT_ACTIONS.some((a) => a.v === acao)) {
    const negate = acao === "nao_recebeu";
    addEmbed(qq, ENG, "campaign_send_log", negate ? "!left" : "!inner");
    if (camp === "any_email") qq = qq.not(`${ENG}.email`, "is", null);
    else if (camp === "any_wa") qq = qq.eq(`${ENG}.provider`, "zernio_cloud_api");
    else qq = qq.eq(`${ENG}.source_campaign_id`, camp);
    if (acao === "recebeu" || acao === "nao_recebeu") qq = qq.not(`${ENG}.sent_at`, "is", null);
    if (acao === "abriu") qq = qq.not(`${ENG}.opened_at`, "is", null);
    if (acao === "recebeu_nao_abriu") qq = qq.not(`${ENG}.sent_at`, "is", null).is(`${ENG}.opened_at`, null);
    if (acao === "clicou") qq = qq.not(`${ENG}.clicked_at`, "is", null);
    if (acao === "recebeu_nao_clicou") qq = qq.not(`${ENG}.sent_at`, "is", null).is(`${ENG}.clicked_at`, null);
    if (acao === "nao_entregue") qq = qq.in(`${ENG}.status`, ["failed", "error", "bounced"]);
    if (negate) qq = qq.is(ENG, null);
  }
  const form = String(f?.conv_form ?? "").trim();
  if (form) {
    addEmbed(qq, CONV, "lead_activity_log", "!inner");
    qq = qq.eq(`${CONV}.event_type`, "form_submission").eq(`${CONV}.event_data->>form_name`, form);
  }
  return qq as Q;
}
