import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { forceCtaDestination, officialCtaUrl } from "./cta.ts";

Deno.test("aceita simulador de WhatsApp com URL encurtada oficial", () => {
  const cfg = { cta_principal: { tipo: "whatsapp", url: "https://s.smartdent.com.br/9k8sn6" } };
  assertEquals(officialCtaUrl(cfg), "https://s.smartdent.com.br/9k8sn6");
  assertEquals(
    forceCtaDestination('<a href="https://x.com/a">A</a>', cfg),
    '<a href="https://s.smartdent.com.br/9k8sn6">A</a>',
  );
});

Deno.test("continua aceitando o formulário oficial", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "form", url: "https://s.smartdent.com.br/abc" } }), "https://s.smartdent.com.br/abc");
});

Deno.test("recusa wa.me e landing page", () => {
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "whatsapp", url: "https://wa.me/5516999" } }), null);
  assertEquals(officialCtaUrl({ cta_principal: { tipo: "landing", url: "https://s.smartdent.com.br/abc" } }), null);
  assertThrows(() => forceCtaDestination("<a href=\"https://x.com\">x</a>", {}));
});
