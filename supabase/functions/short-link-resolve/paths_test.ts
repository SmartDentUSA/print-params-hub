import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pagePath, whatsappSimulatorPath } from "./paths.ts";
import { normalizeClickOrigin } from "../_shared/click-origin.ts";

Deno.test("link curto do WhatsApp abre o simulador do formulário", () => {
  assertEquals(
    whatsappSimulatorPath("703a27a1-334b-43ea-81ab-502e7f50dad9", "abc234"),
    "/embed/dra-lia?form=703a27a1-334b-43ea-81ab-502e7f50dad9&utm_source=short_link&utm_medium=whatsapp_lia&utm_campaign=abc234",
  );
});

Deno.test("simulador recebe a origem do clique em utm_term", () => {
  assertEquals(
    whatsappSimulatorPath("f1", "abc234", "sms"),
    "/embed/dra-lia?form=f1&utm_source=short_link&utm_medium=whatsapp_lia&utm_campaign=abc234&utm_term=sms",
  );
});

Deno.test("landing sem origem mantém o endereço de sempre", () => {
  assertEquals(pagePath("landing_page", "black26_campanha_ativa", "v7pmii"), "/lp/black26_campanha_ativa");
});

Deno.test("landing com origem de e-mail recebe utm_source=email", () => {
  assertEquals(
    pagePath("landing_page", "black26_campanha_ativa", "v7pmii", "email"),
    "/lp/black26_campanha_ativa?utm_source=email&utm_medium=shortlink&utm_campaign=v7pmii",
  );
});

Deno.test("origem desconhecida é ignorada", () => {
  assertEquals(normalizeClickOrigin("tiktok"), null);
  assertEquals(normalizeClickOrigin("GRUPOS"), "grupos");
});
