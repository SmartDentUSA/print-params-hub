import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { landingToEmail } from "./landing-email.ts";

const LANDING = `<html><head><title>BLACK26 Smart Dent</title></head><body>
<div class="topbar"><span data-bar-label>BLACK26 · termina em</span></div>
<header class="hdr"><a class="brand"><img src="https://admin.smartdent.com.br/__l5e/logo.png" alt="Smart Dent"></a>
  <nav><a href="#ofertas">Todas as ofertas</a></nav></header>
<main>
<section class="hero"><h1>Aproveite descontos <span class="hot">imperdíveis</span></h1>
  <p class="lead">O desconto cai a cada fase: <strong>25% → 15% → 10%</strong>.</p>
  <aside class="clock"><h2 data-hero-kicker>Fase atual</h2><p class="big" data-hero-title>Carregando…</p>
  <div class="cells" role="timer"><div><b data-hero-u="d">00</b></div></div></aside></section>
<section class="catalog"><h2>Todas as ofertas <em>BLACK26</em></h2>
  <div class="chips"><button class="chip">Todas</button></div>
  <div class="grid"><article class="card" data-slug="model-plus" data-name="Model Plus"></article></div></section>
<section class="final"><h2>O relógio não para.</h2>
  <a class="btn btn-wa" href="#" data-wa data-slug="geral-chamada-final">Chamar agora no WhatsApp</a></section>
</main>
<footer class="ftr"><h4>Contato</h4><ul><li><a href="tel:+551634194735">+55 16 3419-4735</a></li></ul></footer>
<script>var CONFIG={}</script></body></html>`;

const mail = landingToEmail({
  html: LANDING,
  ctaUrl: "https://s.smartdent.com.br/v7pmii?o=email",
  cards: [{ slug: "model-plus", name: "Model Plus", category: "Resinas 3D", imageUrl: "https://x/model.webp", offer: null }],
  simulatorIds: new Set(["model-plus"]),
  countdown: null,
  countdownUrl: (kind) => `https://x/functions/v1/email-countdown?k=${kind}`,
});

Deno.test("o e-mail é a própria landing, na mesma ordem", () => {
  const order = ["Aproveite descontos", "Todas as ofertas", "Model Plus", "O relógio não para.", "Chamar agora no WhatsApp", "+55 16 3419-4735"]
    .map((t) => mail.html.indexOf(t));
  assert(order.every((i) => i > 0), JSON.stringify(order));
  assertEquals([...order].sort((a, b) => a - b), order);
  assertEquals(mail.subject, "BLACK26 Smart Dent");
  assertEquals(mail.preheader, "O desconto cai a cada fase: 25% → 15% → 10%.");
});

Deno.test("cronômetro da página vira a imagem animada; textos preenchidos por script ficam de fora", () => {
  assert(mail.html.includes('src="https://x/functions/v1/email-countdown?k=tier"'));
  assert(!mail.html.includes("Carregando"));
  assert(!mail.html.includes("termina em</span>"));
});

Deno.test("botões levam ao link oficial; card abre o simulador do produto; telefone vira texto", () => {
  assert(mail.html.includes("https://s.smartdent.com.br/v7pmii?o=email&amp;sim=model-plus"));
  assert(!mail.html.includes("tel:"));
  assert(!mail.html.includes("href=\"#"));
  assert(!mail.html.includes("<script"));
});
