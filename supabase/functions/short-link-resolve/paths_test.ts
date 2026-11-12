import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { whatsappSimulatorPath } from "./paths.ts";

Deno.test("link curto do WhatsApp abre o simulador do formulário", () => {
  assertEquals(
    whatsappSimulatorPath("703a27a1-334b-43ea-81ab-502e7f50dad9", "abc234"),
    "/embed/dra-lia?form=703a27a1-334b-43ea-81ab-502e7f50dad9&utm_source=short_link&utm_medium=whatsapp_lia&utm_campaign=abc234",
  );
});
