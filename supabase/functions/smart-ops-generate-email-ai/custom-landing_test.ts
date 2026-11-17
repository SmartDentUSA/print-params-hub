import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractCustomLandingText, extractLandingCards, insertProductCards, PRODUCT_CARDS_MARKER,
  renderProductCardsHtml, stripCommercialValues,
} from "./custom-landing.ts";

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

Deno.test("lê os cards de produto da landing sem valores comerciais", () => {
  const html = `<article class="card rv" data-cat="resinas" data-slug="bite-splint-flex" data-name="Resina Bite Splint +Flex">
    <div class="cat">Resinas 3D</div><h3>Resina Bite Splint +Flex</h3></article>
    <article class="card rv" data-slug="combo-vitality-nanoclean" data-name="Combo 3 Vitality com 15% OFF + NanoClean PoD de brinde"><div class="cat">Combos e brindes</div></article>
    <article class="card rv" data-slug="bite-splint-flex" data-name="Duplicado"></article>`;
  assertEquals(extractLandingCards(html), [
    { slug: "bite-splint-flex", name: "Resina Bite Splint +Flex", category: "Resinas 3D" },
    { slug: "combo-vitality-nanoclean", name: "Combo 3 Vitality + NanoClean PoD de brinde", category: "Combos e brindes" },
  ]);
});

Deno.test("cada card abre o simulador do produto pelo link do botão principal", () => {
  const html = renderProductCardsHtml(
    [{ slug: "model-plus", name: "Model Plus", category: "Resinas 3D", imageUrl: "https://x.supabase.co/a.png" }],
    "https://s.smartdent.com.br/v7pmii?o=email",
  );
  assert(html.includes('href="https://s.smartdent.com.br/v7pmii?o=email&amp;sim=model-plus"'));
  assert(html.includes('src="https://x.supabase.co/a.png"'));
});

Deno.test("cards entram no marcador ou antes do bloco do botão", () => {
  assertEquals(insertProductCards(`a${PRODUCT_CARDS_MARKER}b`, "C"), "aCb");
  assertEquals(insertProductCards(`<body>x<section data-section="cta">y</section></body>`, "C"), `<body>xC<section data-section="cta">y</section></body>`);
  assertEquals(insertProductCards(`a${PRODUCT_CARDS_MARKER}b`, ""), "ab");
});
