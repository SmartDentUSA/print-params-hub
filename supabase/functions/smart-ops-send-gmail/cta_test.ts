import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { forceCtaDestination, officialCtaUrl } from "./cta.ts";

Deno.test("aceita simulador de WhatsApp com URL encurtada oficial e marca origem e-mail", () => {
  const cfg = { cta_principal: { tipo: "whatsapp", url: "https://s.smartdent.com.br/9k8sn6" } };
  assertEquals(officialCtaUrl(cfg), "https://s.smartdent.com.br/9k8sn6?o=email");
  assertEquals(
    forceCtaDestination('<a href="https://x.com/a">A</a>', cfg),
    '<a href="https://s.smartdent.com.br/9k8sn6?o=email">A</a>',
  );
});

Deno.test("continua aceitando o formulário oficial", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "form", url: "https://s.smartdent.com.br/abc" } }), "https://s.smartdent.com.br/abc?o=email");
});

Deno.test("aceita a landing page pelo link curto oficial", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "landing", url: "https://s.smartdent.com.br/v7pmii?o=email" } }), "https://s.smartdent.com.br/v7pmii?o=email");
});

Deno.test("e-mail nunca sai com outra origem", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "landing", url: "https://s.smartdent.com.br/v7pmii?o=sms" } }), "https://s.smartdent.com.br/v7pmii?o=email");
});

Deno.test("recusa wa.me e endereços que não são o link curto oficial", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "whatsapp", url: "https://wa.me/5516999" } }), null);
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "landing", url: "https://www.smartdent.com.br/lp/x" } }), null);
  assertThrows(() => forceCtaDestination("<a href=\"https://x.com\">x</a>", {}));
});
