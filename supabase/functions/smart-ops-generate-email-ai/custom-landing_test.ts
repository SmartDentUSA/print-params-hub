import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractCustomLandingText, stripCommercialValues } from "./custom-landing.ts";

Deno.test("extrai título, texto visível e primeira imagem pública", () => {
  const html = `<html><head><title>T</title><style>.a{}</style></head><body>
    <script>var x=1</script><img src="data:image/png;base64,AAA"><img src="https://admin.smartdent.com.br/__l5e/a.jpg">
    <h1>BLACK26 &amp; Smart Dent</h1><p>Linha um</p><p>Linha um</p><li>Scanner BLZ</li></body></html>`;
  const r = extractCustomLandingText(html);
  assertEquals(r.title, "BLACK26 & Smart Dent");
  assertEquals(r.imageUrl, "https://admin.smartdent.com.br/__l5e/a.jpg");
  assertEquals(r.text.split("\n"), ["BLACK26 & Smart Dent", "Linha um", "Scanner BLZ"]);
  assert(!r.text.includes("var x"));
});

Deno.test("remove preços e percentuais de desconto", () => {
  assertEquals(stripCommercialValues("De R$ 1.299,90 por R$ 999 com 25% off"), "De por com off");
});
