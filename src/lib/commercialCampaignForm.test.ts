import { test } from "node:test";
import assert from "node:assert/strict";
import { isCommercialCampaignName, isWhatsAppGroupLink } from "./commercialCampaignForm";

test("formulário de campanha comercial é identificado pelo prefixo do nome", () => {
  assert.equal(isCommercialCampaignName("# - CAMPANHA COMERCIAL - Black 26"), true);
  assert.equal(isCommercialCampaignName("# - GRUPO WHATSAPP - Black 26"), false);
});

test("a campanha só redireciona para link de grupo do WhatsApp", () => {
  assert.equal(isWhatsAppGroupLink("https://chat.whatsapp.com/AbC123"), true);
  assert.equal(isWhatsAppGroupLink("https://loja.smartdent.com.br/"), false);
});
