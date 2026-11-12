import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSocialPostTemplate, captionHasHashtag, normalizeHashtags } from "./promo-social.ts";
import { renderCreativeMessage } from "./creative-message.ts";

Deno.test("normaliza hashtags digitadas no editor", () => {
  assertEquals(normalizeHashtags("#Black26, smartdent  #black26 ##IN26"), ["black26", "smartdent", "in26"]);
  assertEquals(normalizeHashtags(""), []);
});

Deno.test("só casa a hashtag exata da tabela", () => {
  assert(captionHasHashtag("Oferta #Black26 hoje", ["black26"]));
  assert(!captionHasHashtag("Oferta #black2026", ["black26"]));
  assert(!captionHasHashtag("black26 sem cerquilha", ["black26"]));
  assert(!captionHasHashtag(null, ["black26"]));
});

Deno.test("mensagem tem resumo, link e cupom do vendedor", () => {
  const t = buildSocialPostTemplate("Resumo do post", "https://www.instagram.com/p/ABC/");
  const withCoupon = renderCreativeMessage(t, { code: "DANILO10", valid_until: "2026-11-30" });
  assert(withCoupon.startsWith("Resumo do post\n\n👉 https://www.instagram.com/p/ABC/"));
  assert(withCoupon.includes("*DANILO10*"));
  assert(withCoupon.includes("30/11/2026"));
  const noCoupon = renderCreativeMessage(t, null);
  assert(noCoupon.includes("https://www.instagram.com/p/ABC/"));
  assert(!noCoupon.includes("cupom"));
  assert(noCoupon.endsWith("só me chamar! 😉"));
});
