import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAssetUrl, ASSET_ORIGIN } from "./assetUrl.ts";

/** Uses globalThis.location to emulate the browser host without jsdom. */
function withHost(host: string, fn: () => void) {
  const original = globalThis.location;
  (globalThis as { location?: unknown }).location = new URL(`https://${host}/`);
  try {
    fn();
  } finally {
    (globalThis as { location?: unknown }).location = original;
  }
}

test("keeps CDN asset path on Lovable-managed hosts", () => {
  for (const host of ["admin.smartdent.com.br", "print-params-hub.lovable.app", "localhost", "127.0.0.1"]) {
    withHost(host, () => {
      assert.equal(resolveAssetUrl("/__l5e/assets-v1/abc/logo.png"), "/__l5e/assets-v1/abc/logo.png");
    });
  }
});
test("points CDN assets to admin origin on the public www site", () => {
  withHost("www.smartdent.com.br", () => {
    assert.equal(
      resolveAssetUrl("/__l5e/assets-v1/abc/smartdent-logo-light.png"),
      `${ASSET_ORIGIN}/__l5e/assets-v1/abc/smartdent-logo-light.png`,
    );
  });
});
test("leaves non-CDN and external URLs untouched", () => {
  withHost("www.smartdent.com.br", () => {
    assert.equal(resolveAssetUrl("/favicon-192x192.png"), "/favicon-192x192.png");
    assert.equal(resolveAssetUrl("https://example.com/img.png"), "https://example.com/img.png");
  });
});
