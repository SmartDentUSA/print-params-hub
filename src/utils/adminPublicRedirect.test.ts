import { test } from "node:test";
import assert from "node:assert/strict";
import { publicRedirectTarget } from "./adminPublicRedirect.ts";

test("moves public knowledge pages from admin to www", () => {
  assert.equal(publicRedirectTarget("admin.smartdent.com.br", "/base-conhecimento/a/x", "?q=1", ""),
    "https://www.smartdent.com.br/base-conhecimento/a/x?q=1");
});
test("keeps internal tools on admin", () => {
  assert.equal(publicRedirectTarget("admin.smartdent.com.br", "/smartops", "", ""), null);
  assert.equal(publicRedirectTarget("admin.smartdent.com.br", "/portal-cursos/abc", "", ""), null);
});
test("does nothing on www", () => {
  assert.equal(publicRedirectTarget("www.smartdent.com.br", "/base-conhecimento", "", ""), null);
});
