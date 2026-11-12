import { describe, expect, it } from "vitest";
import { isCommercialCampaignName, isWhatsAppGroupLink } from "./commercialCampaignForm";

describe("formulário de campanha comercial", () => {
  it("é identificado pelo prefixo do nome", () => {
    expect(isCommercialCampaignName("# - CAMPANHA COMERCIAL - Black 26")).toBe(true);
    expect(isCommercialCampaignName("# - GRUPO WHATSAPP - Black 26")).toBe(false);
  });
  it("só redireciona para link de grupo do WhatsApp", () => {
    expect(isWhatsAppGroupLink("https://chat.whatsapp.com/AbC123")).toBe(true);
    expect(isWhatsAppGroupLink("https://loja.smartdent.com.br/")).toBe(false);
  });
});
