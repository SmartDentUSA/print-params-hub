import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveClickOrigin, originFromReferrer } from "./clickOrigin";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("?o= vence e fica guardado para o simulador", () => {
  const s = mem();
  assert.equal(resolveClickOrigin("?o=sms", "", "www.smartdent.com.br", s), "sms");
  assert.equal(resolveClickOrigin("?form=x", "https://www.smartdent.com.br/lp/a", "www.smartdent.com.br", s), "sms");
});
test("sem marcação usa o site de origem", () => {
  assert.equal(originFromReferrer("https://l.instagram.com/?u=x"), "instagram");
  assert.equal(originFromReferrer("https://www.google.com/"), "google");
  assert.equal(resolveClickOrigin("", "https://lm.facebook.com/", "www.smartdent.com.br", mem()), "facebook");
});
test("utm_source de rede social vira origem", () => {
  assert.equal(resolveClickOrigin("?utm_source=ig", "", "x", mem()), "instagram");
});
test("acesso sem nada fica sem origem", () => {
  assert.equal(resolveClickOrigin("?utm_source=landing_page", "", "x", mem()), null);
});
