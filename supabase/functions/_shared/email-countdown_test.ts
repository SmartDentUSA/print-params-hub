import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  countdownImageUrl, countdownParts, countdownState, parseCountdownParams, parseLandingCountdownConfig,
} from "./email-countdown.ts";

const LANDING = `var CONFIG = {
  start: '2026-11-16T00:00:00-03:00',
  phases: [
    {n:1, pct:25, end:'2026-11-21T00:00:00-03:00', label:'16 a 20/11'},
    {n:2, pct:15, end:'2026-11-26T00:00:00-03:00', label:'21 a 25/11'},
    {n:3, pct:10, end:'2026-12-01T00:00:00-03:00', label:'26 a 30/11'}
  ],
  campaign: 'BLACK26'
};`;
const cfg = parseLandingCountdownConfig(LANDING)!;
const at = (iso: string) => Date.parse(iso);

Deno.test("lê as fases da landing", () => {
  assertEquals(cfg.pcts, [25, 15, 10]);
  assertEquals(cfg.campaign, "BLACK26");
  assertEquals(cfg.ends[2], at("2026-12-01T03:00:00Z"));
});

Deno.test("17/11 está na fase 1 (25%) e termina às 00:00 de 21/11", () => {
  const s = countdownState(at("2026-11-17T12:00:00-03:00"), cfg, "tier");
  assertEquals(s.label, "Fase 1 · 25% OFF termina em");
  assertEquals(s.next, "Depois disso o desconto cai para 15% OFF (fase 2).");
  assertEquals(s.end, at("2026-11-21T00:00:00-03:00"));
});

Deno.test("23/11 está na fase 2 (15%)", () => {
  assertEquals(countdownState(at("2026-11-23T10:00:00-03:00"), cfg, "tier").label, "Fase 2 · 15% OFF termina em");
});

Deno.test("última fase avisa que o preço volta ao normal depois de 30/11", () => {
  assertEquals(countdownState(at("2026-11-28T10:00:00-03:00"), cfg, "tier").next,
    "Última fase. Depois de 30/11 o preço volta ao normal.");
});

Deno.test("desconto fixo e condição especial contam até o fim da campanha", () => {
  const now = at("2026-11-17T12:00:00-03:00");
  const f = countdownState(now, cfg, "fixed", 50);
  assertEquals([f.label, f.end], ["50% OFF fixo termina em", at("2026-12-01T00:00:00-03:00")]);
  assertEquals(countdownState(now, cfg, "end").label, "Condição BLACK26 termina em");
});

Deno.test("depois de 30/11 a oferta aparece encerrada", () => {
  assertEquals(countdownState(at("2026-12-01T00:00:01-03:00"), cfg, "tier").over, true);
});

Deno.test("partes do tempo restante", () => {
  assertEquals(countdownParts(((3 * 24 + 5) * 3600 + 7 * 60 + 9) * 1000), { d: 3, h: 5, m: 7, s: 9 });
});

Deno.test("a URL da imagem devolve as mesmas fases", () => {
  const url = countdownImageUrl("https://x.supabase.co", cfg, "fixed", 50);
  const parsed = parseCountdownParams(new URL(url).searchParams)!;
  assertEquals(parsed.cfg, cfg);
  assertEquals([parsed.kind, parsed.fixedPct], ["fixed", 50]);
});

Deno.test("parâmetros inválidos são recusados", () => {
  assertEquals(parseCountdownParams(new URLSearchParams("k=tier&s=10&e=5&p=25")), null);
  assertEquals(parseCountdownParams(new URLSearchParams("k=xx&s=1&e=5&p=25")), null);
});
