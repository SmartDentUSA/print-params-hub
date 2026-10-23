import { test } from "node:test";
import assert from "node:assert/strict";
import { isBioPageVisit } from "./bioMetrics.ts";

test("same Bio page keeps visits across hosts, query parameters and trailing slash", () => {
  for (const path of ["/bio/smart-dent-fluxo-digital", "/bio/smart-dent-fluxo-digital/?utm_source=ig", "https://parametros.smartdent.com.br/bio/smart-dent-fluxo-digital?x=1", "https://www.smartdent.com.br/bio/smart-dent-fluxo-digital"]) {
    assert.equal(isBioPageVisit(path, "smart-dent-fluxo-digital"), true);
  }
});
test("different Bio pages and nested paths do not enter this page total", () => {
  for (const path of [null, "/bio/other", "/bio/smart-dent-fluxo-digital-extra", "/bio/smart-dent-fluxo-digital/card"]) {
    assert.equal(isBioPageVisit(path, "smart-dent-fluxo-digital"), false);
  }
});