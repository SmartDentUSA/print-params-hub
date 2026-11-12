import { assertEquals } from "jsr:@std/assert@1";
import { buildCreativeTemplate, pickCoupon, renderCreativeMessage } from "./creative-message.ts";

const tpl = buildCreativeTemplate("Olá!");

Deno.test("com cupom: código e validade preenchidos", () => {
  assertEquals(renderCreativeMessage(tpl, { code: "DANI10", valid_until: "2026-11-30" }),
    "Olá!\n\nPara compras de resinas e insumos compre diretamente no site com desconto 👇\nUtilizando o cupom: *DANI10*\nCupom válido até: 30/11/2026\n\nPara equipamentos só me chamar! 😉");
});
Deno.test("sem cupom: some o bloco do cupom, fica só equipamentos", () => {
  assertEquals(renderCreativeMessage(tpl, null), "Olá!\n\nPara equipamentos só me chamar! 😉");
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
