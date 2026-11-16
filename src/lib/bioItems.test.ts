import { test } from "node:test";
import assert from "node:assert/strict";
import { bioItemShowsWhatsApp } from "./bioItems";

test("card sem a flag mantém o botão WhatsApp", () => {
  assert.equal(bioItemShowsWhatsApp({}), true);
  assert.equal(bioItemShowsWhatsApp({ show_whatsapp: true }), true);
});

test("card com a flag desligada mostra só o link de acesso", () => {
  assert.equal(bioItemShowsWhatsApp({ show_whatsapp: false }), false);
});
