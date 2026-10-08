import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { composeConversation, priceFree } from "./conversation.ts";

const context = { product: "CHAIRSIDE SMART A.I. PRO", profile: { imprime_guias: true }, answers: [], sources: ["Módulo de planejamento digital."] };
Deno.test("no knowledge means no invented message and no model call", async () => {
  let calls = 0;
  assertEquals(await composeConversation({ ...context, sources: [] }, async () => { calls++; return "invented"; }, () => false), null);
  assertEquals(calls, 0);
});
Deno.test("prices never reach the generation prompt", async () => {
  let prompt = "";
  await composeConversation({ ...context, sources: ["Planejamento digital. Preço: R$ 61.070,00."] }, async (messages) => { prompt = JSON.stringify(messages); return "O módulo contempla planejamento digital."; }, () => false);
  assertEquals(prompt.includes("61.070"), false);
  assertEquals(priceFree("Planejamento digital. Preço: R$ 61.070,00."), "Planejamento digital.");
});
Deno.test("unconfirmed handoff promises are rejected", async () => {
  assertEquals(await composeConversation(context, async () => "Já enviei tudo para Lucas, tudo pronto.", () => false), null);
});
Deno.test("injection cannot initiate generation", async () => {
  let calls = 0;
  assertEquals(await composeConversation(context, async () => { calls++; return "text"; }, () => true), null);
  assertEquals(calls, 0);
});
Deno.test("grounded message can be returned without changing form answers", async () => {
  const before = JSON.stringify(context);
  assertEquals(await composeConversation(context, async () => "O módulo contempla planejamento digital.", () => false), "O módulo contempla planejamento digital.");
  assertEquals(JSON.stringify(context), before);
});