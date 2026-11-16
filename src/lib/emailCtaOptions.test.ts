import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLandingCtaOptions, buildSimulatorCtaOptions } from "./emailCtaOptions";

const forms = [
  { slug: "black26", name: "BLACK26 Engajamento" },
  { slug: "chatsite", name: "CHATSITE" },
];

test("oferece só links do simulador de WhatsApp com a URL encurtada oficial", () => {
  const opts = buildSimulatorCtaOptions([
    { short_code: "9k8sn6", form_slug: "black26", default_target: "whatsapp" },
    { short_code: "abc123", form_slug: "black26", default_target: "form" },
    { short_code: "lp9999", form_slug: "chatsite", default_target: "landing_page" },
  ], forms);
  assert.deepEqual(opts.map(o => o.url), ["https://s.smartdent.com.br/9k8sn6"]);
  assert.equal(opts[0].tipo, "whatsapp");
});

test("ignora simulador cujo formulário não existe", () => {
  const opts = buildSimulatorCtaOptions([
    { short_code: "zzz111", form_slug: "apagado", default_target: "whatsapp" },
  ], forms);
  assert.deepEqual(opts, []);
});

test("oferece as landing pages publicadas com o link curto marcado como e-mail", () => {
  const opts = buildLandingCtaOptions([
    { short_code: "v7pmii", form_slug: "black26", default_target: "landing_page" },
    { short_code: "lp9999", form_slug: "chatsite", default_target: "landing_page" },
    { short_code: "9k8sn6", form_slug: "black26", default_target: "whatsapp" },
  ], forms, new Map([["black26", "lp-black26"]]));
  assert.deepEqual(opts.map(o => o.url), ["https://s.smartdent.com.br/v7pmii?o=email"]);
  assert.equal(opts[0].tipo, "landing");
  assert.equal(opts[0].id, "lp-black26");
});
