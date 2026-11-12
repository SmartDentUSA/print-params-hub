// Campanhas comerciais: formulários sdr_captacao identificados pelo prefixo do nome
// (mesmo padrão dos formulários de grupo de WhatsApp). Regra espelhada em
// supabase/functions/lia-capture/commercial-campaign.ts.
export const COMMERCIAL_CAMPAIGN_PREFIX = "# - CAMPANHA COMERCIAL - ";
export const DEFAULT_INTEREST_QUESTION = "O que você busca nesta promoção?";
export const DEFAULT_GROUP_MESSAGE =
  "Se quiser tirar dúvidas com experts, assim como trocar experiências com os usuários, acesse o grupo de WhatsApp exclusivo.";

export function isCommercialCampaignName(name: string | null | undefined) {
  return /^#\s*-\s*campanha comercial\s*-/i.test(
    String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
}

export function isWhatsAppGroupLink(value: string | null | undefined) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" && url.hostname === "chat.whatsapp.com" && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
