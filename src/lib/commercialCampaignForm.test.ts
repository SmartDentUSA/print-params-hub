import { test } from "node:test";
import assert from "node:assert/strict";
import { isCommercialCampaignForm, isCommercialCampaignName, isWhatsAppGroupLink } from "./commercialCampaignForm";

test("formulário de campanha comercial é identificado pelo prefixo do nome", () => {
  assert.equal(isCommercialCampaignName("# - CAMPANHA COMERCIAL - Black 26"), true);
  assert.equal(isCommercialCampaignName("# - GRUPO WHATSAPP - Black 26"), false);
});

test("a campanha só redireciona para link de grupo do WhatsApp", () => {
  assert.equal(isWhatsAppGroupLink("https://chat.whatsapp.com/AbC123"), true);
  assert.equal(isWhatsAppGroupLink("https://loja.smartdent.com.br/"), false);
});

test("formulário marcado continua campanha comercial depois de renomeado", () => {
  assert.equal(isCommercialCampaignForm({ is_commercial_campaign: true, name: "# - [BLACK26] - Engajamento" }), true);
  assert.equal(isCommercialCampaignForm({ is_commercial_campaign: false, name: "# - FORMS - exocad" }), false);
});
