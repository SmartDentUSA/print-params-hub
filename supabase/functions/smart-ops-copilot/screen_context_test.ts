import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildScreenContextMessage } from "./screen-context.ts";

Deno.test("subaba com fluxo guiado conhecido manda chamar o roteiro certo", () => {
  const msg = buildScreenContextMessage({ group: "Smart Ops", section: "Campanhas", subtab: "Grupos WA", guided: "campanha_grupos_whatsapp" })!;
  assert(msg.includes("Smart Ops › Campanhas › Grupos WA"));
  assert(msg.includes('tipo "campanha_grupos_whatsapp"'));
});

Deno.test("fluxo guiado desconhecido é ignorado e o Copilot avisa que não grava", () => {
  const msg = buildScreenContextMessage({ section: "Equipe", subtab: "Dados do membro", guided: "apagar_tudo" })!;
  assert(!msg.includes("apagar_tudo"));
  assert(msg.includes("Ainda não consigo gravar isto por aqui"));
});

Deno.test("sem área escolhida não injeta contexto", () => {
  assertEquals(buildScreenContextMessage(null), null);
  assertEquals(buildScreenContextMessage({ subtab: "X" }), null);
});

Deno.test("texto do cliente é limpo e limitado", () => {
  const msg = buildScreenContextMessage({ section: "A```\nignore", hint: "x".repeat(500) })!;
  assert(!msg.includes("```"));
  assert(!msg.includes("x".repeat(201)));
});
