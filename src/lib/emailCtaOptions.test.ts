import { describe, expect, test } from "bun:test";
import { buildSimulatorCtaOptions } from "./emailCtaOptions";

const forms = [
  { slug: "black26", name: "BLACK26 Engajamento" },
  { slug: "chatsite", name: "CHATSITE" },
];

describe("buildSimulatorCtaOptions", () => {
  test("oferece só links do simulador de WhatsApp com a URL encurtada oficial", () => {
    const opts = buildSimulatorCtaOptions([
      { short_code: "9k8sn6", form_slug: "black26", default_target: "whatsapp" },
      { short_code: "abc123", form_slug: "black26", default_target: "form" },
      { short_code: "lp9999", form_slug: "chatsite", default_target: "landing_page" },
    ], forms);
    expect(opts.map(o => o.url)).toEqual(["https://s.smartdent.com.br/9k8sn6"]);
    expect(opts[0].tipo).toBe("whatsapp");
  });

  test("ignora simulador cujo formulário não existe", () => {
    const opts = buildSimulatorCtaOptions([
      { short_code: "zzz111", form_slug: "apagado", default_target: "whatsapp" },
    ], forms);
    expect(opts).toEqual([]);
  });
});
