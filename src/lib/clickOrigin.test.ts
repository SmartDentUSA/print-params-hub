import { test } from "node:test";
import assert from "node:assert/strict";
import { clickOriginFromSearch, normalizeClickOrigin, originForCampaignChannel, withClickOrigin } from "./clickOrigin";

test("link curto recebe a origem do canal", () => {
  assert.equal(withClickOrigin("https://s.smartdent.com.br/v7pmii", "email"), "https://s.smartdent.com.br/v7pmii?o=email");
  assert.equal(withClickOrigin("https://s.smartdent.com.br/v7pmii", "sms"), "https://s.smartdent.com.br/v7pmii?o=sms");
});

test("links que não são curtos oficiais não mudam", () => {
  assert.equal(withClickOrigin("https://chat.whatsapp.com/abc", "grupos"), "https://chat.whatsapp.com/abc");
});

test("origem é lida da landing (utm_source) e do simulador (utm_term)", () => {
  assert.equal(clickOriginFromSearch("?utm_source=email&utm_medium=shortlink&utm_campaign=v7pmii"), "email");
  assert.equal(clickOriginFromSearch("?form=x&utm_source=landing_page&utm_medium=whatsapp_lia&utm_term=sms"), "sms");
  assert.equal(clickOriginFromSearch("?utm_source=landing_page"), null);
});

test("só aceita as origens conhecidas", () => {
  assert.equal(normalizeClickOrigin("Grupos"), "grupos");
  assert.equal(normalizeClickOrigin("facebook"), null);
});

test("grupos de WhatsApp têm origem própria", () => {
  assert.equal(originForCampaignChannel("whatsapp_groups"), "grupos");
  assert.equal(originForCampaignChannel("whatsapp"), "whatsapp");
});
