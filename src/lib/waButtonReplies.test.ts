import { test } from "node:test";
import assert from "node:assert/strict";
import { buttonKey, defaultReplyText, previewReply } from "./waButtonReplies";

test("default text for button 1 (Quero saber mais)", () => {
  assert.equal(defaultReplyText("Quero saber mais"), "Que bom, {primeiro_nome}! Veja todas as ofertas da BLACK26 aqui: {link}");
});

test("default text for button 2 (Falar com consultor)", () => {
  assert.equal(defaultReplyText("Falar com consultor"), "Perfeito, {primeiro_nome}! Fale agora com um consultor da Smart Dent pelo simulador: {link}");
});

test("future labels match the current ones, ignoring accents and capital letters", () => {
  assert.equal(buttonKey("QUERO VER AS OFERTAS"), buttonKey("Quero saber mais"));
  assert.equal(buttonKey("Falar com vendedor"), buttonKey("falar com consultor"));
});

test("text without {link} gets the link at the end", () => {
  assert.equal(previewReply("Olá {primeiro_nome}", "Ana", "https://s.smartdent.com.br/v7pmii"), "Olá Ana https://s.smartdent.com.br/v7pmii");
});
