import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isEchoOfOutbound, normalizeForEcho } from "./echo-guard.ts";

// ── normalizeForEcho ─────────────────────────────────────────────────
Deno.test("normalize: strips emoji, punctuation, case, extra spaces (preserves accents)", () => {
  assertEquals(normalizeForEcho("Olá, Dr.! 👋  Tudo bem?"), "olá dr tudo bem");
  assertEquals(normalizeForEcho("  HELLO  \n\n World  "), "hello world");
  assertEquals(normalizeForEcho(""), "");
  assertEquals(normalizeForEcho(null as unknown as string), "");
});

// ── isEchoOfOutbound: SHOULD detect ──────────────────────────────────
Deno.test("echo: exact match against last outbound", () => {
  const r = isEchoOfOutbound("Olá Dr., posso ajudar?", ["Olá Dr., posso ajudar?"]);
  assertEquals(r.isEcho, true);
  assertEquals(r.reason, "exact");
  assertEquals(r.matchedIndex, 0);
});

Deno.test("echo: same text with added emoji", () => {
  const r = isEchoOfOutbound("Olá Dr., posso ajudar? 👋", ["Olá Dr., posso ajudar?"]);
  assertEquals(r.isEcho, true);
});

Deno.test("echo: case + punctuation difference only", () => {
  const r = isEchoOfOutbound("OLÁ DR POSSO AJUDAR", ["Olá, Dr.! Posso ajudar?"]);
  assertEquals(r.isEcho, true);
});

Deno.test("echo: extra whitespace and newlines", () => {
  const r = isEchoOfOutbound("Olá   Dr.,\n\nposso  ajudar?", ["Olá Dr., posso ajudar?"]);
  assertEquals(r.isEcho, true);
});

Deno.test("echo: long outbound matched as prefix inside inbound", () => {
  const longOut = "Olá Dr., sou a LIA da Smart Dent e posso ajudar com a impressora Anycubic Photon Mono M5s hoje?";
  const inbound = longOut + " — comentário extra do usuário";
  const r = isEchoOfOutbound(inbound, [longOut]);
  assertEquals(r.isEcho, true);
  assertEquals(r.reason, "prefix");
});

Deno.test("echo: matches against any of last 5, not only first", () => {
  const outs = [
    "outra mensagem qualquer enviada antes",
    "mais uma diferente",
    "Olá Dr., posso ajudar com fluxo digital?",
    "primeira saudação enviada",
    "saudação inicial original",
  ];
  const r = isEchoOfOutbound("Olá Dr., posso ajudar com fluxo digital?", outs);
  assertEquals(r.isEcho, true);
  assertEquals(r.matchedIndex, 2);
});

// ── isEchoOfOutbound: should NOT block real conversation ────────────
Deno.test("real: short lead reply 'sim'", () => {
  const r = isEchoOfOutbound("sim", ["Olá Dr., posso ajudar com a Anycubic M5s?"]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: short lead reply 'ok'", () => {
  const r = isEchoOfOutbound("ok", ["Olá Dr., posso ajudar?"]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: pricing question from lead", () => {
  const r = isEchoOfOutbound("quanto custa a m5s?", [
    "Olá Dr., posso ajudar com a Anycubic Photon Mono M5s?",
  ]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: completely different new question", () => {
  const r = isEchoOfOutbound("vocês têm escâner intraoral disponível?", [
    "Olá Dr., posso ajudar com a Anycubic Photon Mono M5s?",
  ]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: empty outbound list", () => {
  const r = isEchoOfOutbound("qualquer mensagem do lead", []);
  assertEquals(r.isEcho, false);
});

Deno.test("real: outbound too short (< 8 chars normalized) ignored as base", () => {
  const r = isEchoOfOutbound("oi", ["oi!", "Olá!"]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: lead repeats one common word from bot", () => {
  const r = isEchoOfOutbound("resina", [
    "Olá Dr., temos várias opções de resina para sua impressora",
  ]);
  assertEquals(r.isEcho, false);
});

Deno.test("real: inbound long but does NOT contain outbound prefix", () => {
  const r = isEchoOfOutbound(
    "Estou com uma dúvida sobre o protocolo de cura UV das resinas modelo",
    ["Olá Dr., posso ajudar com a Anycubic Photon Mono M5s hoje mesmo?"],
  );
  assertEquals(r.isEcho, false);
});

Deno.test("real: empty inbound", () => {
  const r = isEchoOfOutbound("", ["Olá Dr., posso ajudar?"]);
  assertEquals(r.isEcho, false);
});
