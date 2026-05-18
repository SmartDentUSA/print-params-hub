import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeShopUrl } from "./lia-rag.ts";

Deno.test("sanitizeShopUrl: removes trailing dash", () => {
  assertEquals(
    sanitizeShopUrl("https://loja.smartdent.com.br/resina-smart-print-temp-"),
    "https://loja.smartdent.com.br/resina-smart-print-temp",
  );
});

Deno.test("sanitizeShopUrl: removes multiple trailing junk chars", () => {
  assertEquals(
    sanitizeShopUrl("https://loja.smartdent.com.br/foo-/."),
    "https://loja.smartdent.com.br/foo",
  );
});

Deno.test("sanitizeShopUrl: trims whitespace", () => {
  assertEquals(
    sanitizeShopUrl("  https://x.com/y  "),
    "https://x.com/y",
  );
});

Deno.test("sanitizeShopUrl: strips HTML tags", () => {
  assertEquals(
    sanitizeShopUrl("<a href=''>https://x.com/z</a>"),
    "https://x.com/z",
  );
});

Deno.test("sanitizeShopUrl: preserves clean URL", () => {
  assertEquals(
    sanitizeShopUrl("https://loja.smartdent.com.br/smartmake-gode"),
    "https://loja.smartdent.com.br/smartmake-gode",
  );
});

Deno.test("sanitizeShopUrl: null / empty / non-url", () => {
  assertEquals(sanitizeShopUrl(null), null);
  assertEquals(sanitizeShopUrl(""), null);
  assertEquals(sanitizeShopUrl("abc"), null);
  assertEquals(sanitizeShopUrl(undefined), null);
});

Deno.test("sanitizeShopUrl: never breaks scheme", () => {
  // Should not strip into the scheme itself
  assertEquals(sanitizeShopUrl("https://"), null);
});