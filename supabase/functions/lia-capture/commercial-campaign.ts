// Campanhas comerciais: formulários sdr_captacao com nome "# - CAMPANHA COMERCIAL - ...".
// Depois da identificação o lead escolhe um botão de interesse (capture_buttons do formulário);
// o botão escolhido vira o produto de interesse do CRM e da timeline.
export const CAMPAIGN_PREFIX = /^#\s*-\s*campanha comercial\s*-\s*/i;
export const DEFAULT_INTEREST_QUESTION = "O que você busca nesta promoção?";
export const GROUP_REDIRECT_MS = 4000;

export type CaptureButton = { label?: unknown; product_catalog_id?: unknown; product_name?: unknown; workflow_stage_target?: unknown };

const norm = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function isCommercialCampaignName(name: unknown) {
  return CAMPAIGN_PREFIX.test(String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/** Campanha comercial pela marcação permanente do formulário ou, nos antigos, pelo prefixo do nome. */
export function isCommercialCampaignForm(form: { is_commercial_campaign?: unknown; name?: unknown } | null | undefined) {
  return form?.is_commercial_campaign === true || isCommercialCampaignName(form?.name);
}

export function campaignDisplayName(name: unknown, title?: unknown) {
  const t = String(title ?? "").trim();
  if (t) return t;
  const cleaned = String(name ?? "")
    .replace(CAMPAIGN_PREFIX, "")
    .replace(/^#\s*-\s*/, "")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "campanha";
}

export function campaignButtons(enabled: unknown, buttons: unknown): { label: string; product_catalog_id: string | null; product_name: string | null }[] {
  if (!enabled || !Array.isArray(buttons)) return [];
  return (buttons as CaptureButton[])
    .map((b) => ({
      label: String(b?.label ?? "").trim(),
      product_catalog_id: typeof b?.product_catalog_id === "string" && b.product_catalog_id ? b.product_catalog_id : null,
      product_name: typeof b?.product_name === "string" && b.product_name.trim() ? b.product_name.trim() : null,
    }))
    .filter((b) => b.label);
}

export function matchInterest<T extends { label: string }>(buttons: T[], value: unknown): T | null {
  const v = norm(value);
  if (!v) return null;
  return buttons.find((b) => norm(b.label) === v) ?? null;
}
