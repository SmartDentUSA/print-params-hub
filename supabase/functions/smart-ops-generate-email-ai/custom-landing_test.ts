import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractCustomLandingText, extractLandingArtworks, extractLandingCards, extractLandingOffer, fillMissingImages,
  insertProductCards, PRODUCT_CARDS_MARKER, renderProductCardsHtml, safeInline, stripCommercialValues,
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

Deno.test("itens avulsos usam a foto do kit da mesma linha", () => {
  const r = fillMissingImages([
    { slug: "kit-smartmake", name: "Kit SmartMake", category: "", imageUrl: "https://a/kit.png" },
    { slug: "smartmake-avulsos", name: "SmartMake avulsos", category: "", imageUrl: null },
    { slug: "exocad-rms", name: "exocad", category: "", imageUrl: null },
  ]);
  assertEquals(r.map((c) => c.imageUrl), ["https://a/kit.png", "https://a/kit.png", null]);
});

const TIER_CARD = `<article class="card rv" data-slug="nanoclean-pod" data-name="NanoClean PoD">
  <div class="tagrow"><span class="badge" data-badge="tier">Fase 1 · 25% OFF</span></div>
  <a class="photo"><img class="fb" data-b26-src="nanoclean-pod" alt="NanoClean"></a>
  <div class="info"><div class="cat">Resinas 3D</div><h3>NanoClean PoD</h3>
  <div class="save hide" data-mode="range" data-sv='[["160 g", 99.75, 59.85, 39.9]]'></div>
  <div class="nowline" data-prices="399.00|299.25|339.15|359.10"><div class="real">Valor de tabela <s>R$ 399,00</s><br>160 g</div><div class="nowp"></div></div>
  <div class="tw"><table class="pt"><thead><tr><th>Apresentação<small>valores em R$</small></th><th class="c0">Tabela</th><th data-c="1">25%<small>16–20/11</small></th><th data-c="2">15%<small>21–25/11</small></th><th data-c="3">10%<small>26–30/11</small></th></tr></thead>
  <tbody><tr><td>160 g<small>SKU 2314</small></td><td class="c0">399,00</td><td data-c="1">299,25</td><td data-c="2">339,15</td><td data-c="3">359,10</td></tr></tbody></table></div>
  <div class="timer" data-timer="tier" role="timer"><b data-u="d">00</b></div><div class="cta"></div></div></article>`;

const FIXED_CARD = `<article class="card rv" data-slug="model-plus" data-name="Model Plus">
  <span class="badge alt" data-badge="static">50% OFF fixo</span><h3>Model Plus</h3>
  <div class="save">Economize <b>R$ 199,50</b> em toda a campanha</div>
  <div class="nowline" data-prices="399.00|199.50|199.50|199.50"><div class="real">De <s>R$ 399,00</s><br>1.000 g · Bege</div><div class="nowp"></div></div>
  <p class="note">50% de desconto do início ao fim da campanha (16 a 30/11).</p>
  <div class="timer" data-timer="fixed" role="timer"></div></article>`;

Deno.test("card por fase traz a tabela com os descontos de cada fase e o cronômetro da fase", () => {
  const o = extractLandingOffer(TIER_CARD)!;
  assertEquals(o.timer, "tier");
  assertEquals(o.badgeByPhase, true);
  assertEquals(o.tables[0].head, ["Apresentação<br>valores em R$", "Tabela", "25%<br>16–20/11", "15%<br>21–25/11", "10%<br>26–30/11"]);
  assertEquals(o.tables[0].rows[0].cells.map((c) => c.html), ["160 g<br>SKU 2314", "399,00", "299,25", "339,15", "359,10"]);
  assertEquals(o.real, "");
});

Deno.test("card de desconto fixo mostra de/por, economia e cronômetro até o fim", () => {
  const o = extractLandingOffer(FIXED_CARD)!;
  assertEquals([o.badge, o.timer, o.fixedPct], ["50% OFF fixo", "fixed", 50]);
  assertEquals(o.real, "De <s>R$ 399,00</s><br>1.000 g · Bege");
  assertEquals(o.now, "Por R$ 199,50");
  assertEquals(o.save, "Economize <b>R$ 199,50</b> em toda a campanha");
});

Deno.test("trechos da landing só mantêm negrito, riscado e quebra de linha", () => {
  assertEquals(safeInline(`<b onclick="x">A</b><script>y</script><a href="z">C</a>`), "<b>A</b>yC");
});

Deno.test("arte do card vem do mapa de artes da landing", () => {
  const html = `${TIER_CARD}<script>var assets={"nanoclean-pod":"data:image/webp;base64,QUJD"};</script>`;
  assertEquals(extractLandingArtworks(html).get("nanoclean-pod"), { mime: "image/webp", base64: "QUJD" });
});

Deno.test("e-mail mostra a tabela de descontos e o cronômetro do card", () => {
  const o = extractLandingOffer(TIER_CARD)!;
  const html = renderProductCardsHtml(
    [{ slug: "nanoclean-pod", name: "NanoClean PoD", category: "Resinas 3D", imageUrl: "https://x/a.webp", offer: o }],
    "https://s.smartdent.com.br/v7pmii?o=email",
    { countdownUrl: (kind) => `https://x/functions/v1/email-countdown?k=${kind}` },
  );
  assert(html.includes(">299,25<"));
  assert(html.includes("25%<br>16–20/11"));
  assert(html.includes('src="https://x/functions/v1/email-countdown?k=tier"'));
  // o selo "Fase 1" não fica fixo no e-mail: a fase do dia aparece no cronômetro
  assert(!html.includes("Fase 1 · 25% OFF"));
});
