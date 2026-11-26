import { assertEquals } from "jsr:@std/assert@1";
import { isProductAgentTestPhone, matchProduct, whatsappGroupUrl } from "./product-agent-logic.ts";

const cat = [
  { id: "1", name: "Resina 3D Smart Print Bio Vitality" },
  { id: "2", name: "Impressora 3D Rayshape Edge Mini" },
  { id: "3", name: "DentalCAD - Software CAD da exocad" },
  { id: "4", name: "Resina 3D Smart Print Modelo Precision" },
];

Deno.test("só o telefone de teste aciona o atendente", () => {
  assertEquals(isProductAgentTestPhone("5519992612348"), true);
  assertEquals(isProductAgentTestPhone("+55 (19) 9261-2348"), true);
  assertEquals(isProductAgentTestPhone("5516997501531"), false);
});

Deno.test("identifica o produto pelo nome no início da mensagem", () => {
  assertEquals(matchProduct("Vitality quero saber mais", cat)?.id, "1");
  assertEquals(matchProduct("Edge Mini", cat)?.id, "2");
  assertEquals(matchProduct("exocad preço?", cat)?.id, "3");
});

Deno.test("palavra genérica sozinha não vira produto", () => {
  assertEquals(matchProduct("resina", cat), null);
  assertEquals(matchProduct("oi bom dia", cat), null);
});

Deno.test("só aceita link de grupo do WhatsApp", () => {
  assertEquals(whatsappGroupUrl("https://chat.whatsapp.com/AbC123"), "https://chat.whatsapp.com/AbC123");
  assertEquals(whatsappGroupUrl("https://smartdent.com.br"), null);
});
