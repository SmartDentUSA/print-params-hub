import { test } from "node:test";
import assert from "node:assert/strict";
import { bioPublicPath, bioPublicUrl, isBioPageVisit, MAIN_BIO_SLUG } from "./bioMetrics.ts";

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

test("main Bio page also counts the short /linkbio path", () => {
  for (const path of ["/linkbio", "/linkbio/?utm_source=ig", "https://www.smartdent.com.br/linkbio", "https://admin.smartdent.com.br/linkbio?x=1"]) {
    assert.equal(isBioPageVisit(path, MAIN_BIO_SLUG), true);
  }
  assert.equal(isBioPageVisit("/linkbio", "other-page"), false);
  assert.equal(isBioPageVisit("/linkbio/card", MAIN_BIO_SLUG), false);
});

test("public Bio URL uses the www site and the short path for the main page", () => {
  assert.equal(bioPublicPath(MAIN_BIO_SLUG), "/linkbio");
  assert.equal(bioPublicUrl(MAIN_BIO_SLUG), "https://www.smartdent.com.br/linkbio");
  assert.equal(bioPublicPath("outra-pagina"), "/bio/outra-pagina");
  assert.equal(bioPublicUrl("outra-pagina"), "https://www.smartdent.com.br/bio/outra-pagina");
});
