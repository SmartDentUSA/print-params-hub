import { assertEquals } from "jsr:@std/assert@1";
import { composeCreativeMessage, pickCoupon } from "./creative-message.ts";

Deno.test("com cupom: rodapé com código e validade", () => {
  const m = composeCreativeMessage("Olá!", { code: "DANI10", valid_until: "2026-11-30" });
  assertEquals(m, "Olá!\n\nPara compras de resinas e insumos compre diretamente no site com desconto\nUtilizando o cupom: *DANI10*\nCupom válido até: 30/11/2026\nPara equipamentos só me chamar!");
});
Deno.test("sem cupom: só equipamentos", () => {
  assertEquals(composeCreativeMessage("Olá!", null), "Olá!\n\nPara equipamentos só me chamar!");
});
Deno.test("escolhe cupom de validade mais longa e ignora vencido", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  const c = pickCoupon([{ code: "A", valid_until: "2026-11-20" }, { code: "B", valid_until: "2026-11-30" }, { code: "C", valid_until: "2026-10-01" }], now);
  assertEquals(c?.code, "B");
});
