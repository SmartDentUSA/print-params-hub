import { test } from "node:test";
import assert from "node:assert/strict";
import { localPhoneDigits } from "./phoneInput.ts";

test("celular colado com 55 mantém o número inteiro", () => {
  assert.equal(localPhoneDigits("5516974065841"), "16974065841");
  assert.equal(localPhoneDigits("+55 (16) 97406-5841"), "16974065841");
});

test("digitação dígito a dígito com 55 chega ao número correto", () => {
  let value = "";
  for (const ch of "5516974065841") value = localPhoneDigits(value + ch);
  assert.equal(value, "16974065841");
});

test("número sem 55 fica igual", () => {
  assert.equal(localPhoneDigits("(16) 97406-5841"), "16974065841");
  assert.equal(localPhoneDigits("1634194735"), "1634194735");
});
