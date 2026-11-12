import { assertEquals } from "jsr:@std/assert@1";
import { buildCreativeTemplate, cleanAiBody, pickCoupon, renderCreativeMessage } from "./creative-message.ts";

const tpl = buildCreativeTemplate("Oferta!");

Deno.test("com cupom: código e validade preenchidos", () => {
  assertEquals(renderCreativeMessage(buildCreativeTemplate("Oferta!"), { code: "DANI10", valid_until: "2026-11-30" }),
    "Oferta!\n\n🛒 Para compras de *resinas e insumos*, compre diretamente no site com desconto 👇\n🌐 https://loja.smartdent.com.br/\n🎟️ Utilizando o cupom: *DANI10*\n📅 Cupom válido até: *30/11/2026*\n\n🦷 Para *equipamentos*, só me chamar! 😉");
});
Deno.test("sem cupom: some o bloco do cupom, fica só equipamentos", () => {
  assertEquals(renderCreativeMessage(buildCreativeTemplate("Oferta!"), null), "Oferta!\n\n🦷 Para *equipamentos*, só me chamar! 😉");
});
Deno.test("tira a saudação Olá, Doutor(a) do início", () => {
  assertEquals(cleanAiBody("Olá, Doutor(a)! A oportunidade Black 26 já começou."), "A oportunidade Black 26 já começou.");
  assertEquals(cleanAiBody("Oi Doutor, *Black 26* chegou"), "*Black 26* chegou");
});
Deno.test("tira rodapé de cupom que a IA repetir", () => {
  assertEquals(cleanAiBody("🔥 *Black*\n\nUse o cupom X\nCompre já"), "🔥 *Black*\n\nCompre já");
});
Deno.test("cupom sem validade: some só a linha da validade", () => {
  assertEquals(renderCreativeMessage(tpl, { code: "X", valid_until: null }).includes("válido até"), false);
});
Deno.test("modelo editado pelo admin mantém o texto e troca {vendedor}", () => {
  assertEquals(renderCreativeMessage("Oi, aqui é {vendedor}!", null, "Danilo Henrique"), "Oi, aqui é Danilo!");
});
Deno.test("escolhe cupom de validade mais longa e ignora vencido", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  const c = pickCoupon([{ code: "A", valid_until: "2026-11-20" }, { code: "B", valid_until: "2026-11-30" }, { code: "C", valid_until: "2026-10-01" }], now);
  assertEquals(c?.code, "B");
});
