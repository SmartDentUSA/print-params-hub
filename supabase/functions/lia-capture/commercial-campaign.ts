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

/** Nome da campanha na conversa: sem o período de dias ("BlackFriday 16 a 20" → "BlackFriday"). */
export function campaignMessageName(name: unknown) {
  const raw = String(name ?? "").replace(/\s+/g, " ").trim();
  const cleaned = raw
    .replace(/\s*[-–—]?\s*\d{1,2}(?:\/\d{1,2})?\s*(?:a|à|ate|até|-|–|—)\s*\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\s*$/i, "")
    .trim();
  return cleaned || raw;
}

/** Abertura da conversa: cita o item quando o link já trouxe o produto; sem item, fala só da campanha. */
export function campaignOpening(campaign: unknown, item?: string | null) {
  const name = campaignMessageName(campaign);
  const of = `${/^campanha\b/i.test(name) ? "da" : "da campanha"} ${name}`;
  const about = item ? `sobre ${item} ${of}` : of;
  return `Vamos lá, vou te mandar todas as informações ${about}. Qual é o seu telefone de contato?`;
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

export type PresetInterest = { label: string; product_catalog_id: string | null; product_name: string | null };

/** Produto já escolhido fora da conversa (item da landing): botão do formulário pelo produto/rótulo ou produto ativo do catálogo. */
export function presetInterest(
  buttons: PresetInterest[],
  input: { product_catalog_id?: string | null; interest?: unknown },
  catalog: { id: string; name: string } | null,
): PresetInterest | null {
  const id = input.product_catalog_id || null;
  if (id) {
    const button = buttons.find((b) => b.product_catalog_id === id);
    if (button) return button;
    return catalog?.id === id && catalog.name ? { label: catalog.name, product_catalog_id: catalog.id, product_name: catalog.name } : null;
  }
  return matchInterest(buttons, input.interest);
}

const PRICE_PART = /\s*(?:com\s+)?\d+(?:[.,]\d+)?\s*%\s*(?:off|de desconto)?/gi;

/** Nome do item da landing (card do simulador) gravado em custom_simulators; o simulador geral não tem item. */
export function simulatorItemLabel(simulators: unknown, id: unknown): string | null {
  const key = String(id ?? "").trim();
  if (!key || key === "geral" || !Array.isArray(simulators)) return null;
  const sim = (simulators as Array<{ id?: unknown; label?: unknown }>).find((s) => String(s?.id ?? "") === key);
  const label = String(sim?.label ?? "").replace(PRICE_PART, "").replace(/\s+/g, " ").trim();
  return label || null;
}

/**
 * Item que o lead escolheu, para as frases depois da conversão:
 * card da landing (quando a escolha é o próprio card) → produto exato do botão → rótulo do botão.
 */
export function chosenItemLabel(chosen: PresetInterest | null, preset: PresetInterest | null, itemLabel: string | null): string | null {
  if (!chosen) return null;
  if (itemLabel && preset && norm(chosen.label) === norm(preset.label)) return itemLabel;
  return chosen.product_name || chosen.label || null;
}

/** Texto do botão "Me chame agora no WhatsApp", sem artigo (vale para produto e categoria). */
export function sellerWhatsAppText(input: { sellerFirst: string; item: string; campaign?: string | null; ticket: string }) {
  const campaign = input.campaign ? campaignMessageName(input.campaign) : "";
  const about = campaign
    ? `vi a ${/^campanha\b/i.test(campaign) ? "" : "campanha "}${campaign} e quero saber mais sobre ${input.item}`
    : `quero saber mais sobre ${input.item}`;
  return `Olá ${input.sellerFirst}, ${about}. Meu atendimento já foi registrado com o número ${input.ticket}`;
}
